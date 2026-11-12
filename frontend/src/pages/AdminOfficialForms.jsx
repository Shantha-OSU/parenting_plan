import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Archive, CheckCircle2, FileUp, MapPin, Save, Send, Trash2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { auth } from '../lib/firebase';
import { buildApiUrl } from '../lib/apiClient';
import { CUSTOM_COMPARISON_QUESTIONS } from '../lib/comparisonQuestionDefinitions';
import { customFieldLabels, customOptionValues } from './FormDesigner';
import './AdminOfficialForms.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const FORM_OPTIONS = [
  { id: 'oh-dr-form-20', label: 'Ohio Supreme Court Form 20 — Shared Parenting Plan' },
  { id: 'oh-dr-form-21', label: 'Ohio Supreme Court Form 21 — Parenting Plan' },
];

const NON_FINAL_VALUES = ['needMoreInfo', 'defaultToCoParent'];
const CUSTOM_TEXT_VALUE = '__custom_text__';
const CHECKBOX_VALUE = '__checked__';
const SECTION_LABELS = {
  'getting-started': 'Getting Started',
  'parental-rights': 'Parental Rights',
  'parenting-time-communication': 'Parenting Time & Communication',
  'health-insurance-coverage': 'Health Insurance Coverage',
  'custody-schedule': 'Custody & Schedule',
  transportation: 'Transportation',
  'tax-exemptions': 'Tax Exemptions',
  'personal-info': 'Personal info',
  custom: 'Custom answers',
};
const CUSTOM_SOURCE_LABELS = {
  'getting-started.currentCircumstance': 'Current circumstance',
  'getting-started.caseFilingStatus': 'Case filing status',
  'getting-started.courtCustodyOrderIssued': 'Court custody order issued',
  'getting-started.custodyGrantedTo': 'Custody granted to',
  'parentingTimeAndCommunication.parentingSchedule': 'Regular parenting schedule',
  'parentingTimeAndCommunication.holidaySchedule': 'Holiday schedule',
  'parentingTimeAndCommunication.schoolSchedule': 'School schedule',
  'parentingTimeAndCommunication.parentingSchedulesByChild': 'Parenting schedules by child',
  'parentingTimeAndCommunication.holidaySchedulesByChild': 'Holiday schedules by child',
  'parentingTimeAndCommunication.schoolSchedulesByChild': 'School schedules by child',
  'parentingTimeAndCommunication.scheduleScope': 'Schedule scope',
  'taxExemptions.parentRole': 'Tax exemption parent role',
  'taxExemptions.claimingChildren': 'Children claimed for taxes',
  'taxExemptions.childAnswers': 'Tax arrangements by child',
  children: 'Children',
  parentFName: 'Parent first name',
  parentLName: 'Parent last name',
  userRole: 'Parent role',
  currentCircumstance: 'Current circumstance',
  caseFilingStatus: 'Case filing status',
  courtCustodyOrderIssued: 'Court custody order issued',
  custodyGrantedTo: 'Custody granted to',
};

async function adminRequest(user, path, options = {}) {
  const token = await user.getIdToken();
  const response = await fetch(buildApiUrl(`/api/admin${path}`), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });
  if (options.responseType === 'blob') {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Administrator request failed');
    }
    return response.blob();
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() };
  if (!response.ok) throw new Error(payload.error || 'Administrator request failed');
  return payload;
}

function sourceLabel(qKey) {
  const field = String(qKey).split('.').pop();
  return CUSTOM_SOURCE_LABELS[qKey]
    || customFieldLabels[field]
    || CUSTOM_COMPARISON_QUESTIONS[qKey]?.label
    || CUSTOM_COMPARISON_QUESTIONS[qKey]?.qText
    || qKey;
}

function sourceSection(qKey, question) {
  if (question?.section) return SECTION_LABELS[question.section] || question.section;
  if (qKey.startsWith('parentingTimeAndCommunication.')) return SECTION_LABELS['parenting-time-communication'];
  if (qKey.startsWith('taxExemptions.')) return SECTION_LABELS['tax-exemptions'];
  if (qKey.startsWith('getting-started.')) return SECTION_LABELS['getting-started'];
  if (['parentFName', 'parentLName', 'children'].includes(qKey)) return SECTION_LABELS['personal-info'];
  return SECTION_LABELS.custom;
}

function makeMapping(field, isFillable) {
  return {
    pdfField: isFillable ? field.name : null,
    type: field.type === 'unknown' ? 'text' : field.type,
    reviewStatus: 'needs_review',
    rule: { type: 'direct', source: 'answer', qKey: '' },
  };
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function DiffReport({ diff }) {
  if (!diff) return null;
  return (
    <div className="official-forms__diff" aria-label="Version changes">
      <strong>Version changes</strong>
      <span>Added: {diff.added?.length || 0}</span>
      <span>Removed: {diff.removed?.length || 0}</span>
      <span>Type changes: {diff.typeChanged?.length || 0}</span>
      <span>Option changes: {diff.optionChanged?.length || 0}</span>
      {diff.carriedCleanly !== undefined && <span>Carried cleanly: {diff.carriedCleanly}</span>}
      {diff.needsReview !== undefined && <span>Needs review: {diff.needsReview}</span>}
      <span>Unmapped: {diff.unmapped?.length || 0}</span>
    </div>
  );
}

function fieldStatus(fieldName, mappings) {
  const mapping = mappings.find((item) => item.pdfField === fieldName);
  if (!mapping) return 'unmapped';
  return mapping.reviewStatus === 'needs_review' ? 'needs_review' : 'mapped';
}

function nearestText(textItems, x, y) {
  return textItems.reduce((nearest, item) => {
    const itemX = item.transform[4];
    const itemY = item.transform[5];
    const distance = Math.hypot(itemX - x, itemY - y);
    return distance < nearest.distance ? { distance, text: item.str } : nearest;
  }, { distance: Number.POSITIVE_INFINITY, text: '' }).text;
}

function PdfPage({ pdf, pageNumber, mappings, selectedField, placement, onSelect, onPlace }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [pageData, setPageData] = useState(null);
  const [visible, setVisible] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '600px' });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    pdf.getPage(pageNumber).then(async (page) => {
      const viewport = page.getViewport({ scale: 1.25 });
      const text = await page.getTextContent();
      const annotations = await page.getAnnotations({ intent: 'display' });
      if (!active) return;
      setPageData({
        viewport,
        annotations: annotations.filter((annotation) => annotation.subtype === 'Widget').map((annotation) => {
          const fieldName = annotation.fieldName || annotation.parent?.fieldName || '';
          const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annotation.rect);
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          return {
            fieldName,
            exportValue: annotation.exportValue || annotation.buttonValue || '',
            left,
            top,
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
            hint: nearestText(text.items, annotation.rect[0], annotation.rect[1]),
          };
        }),
      });
      const context = canvasRef.current?.getContext('2d');
      if (context) {
        canvasRef.current.width = viewport.width;
        canvasRef.current.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [pdf, pageNumber, visible]);

  useEffect(() => {
    if (!canvasRef.current || !pageData) return undefined;
    const updateScale = () => {
      const bounds = canvasRef.current.getBoundingClientRect();
      setDisplayScale(bounds.width / pageData.viewport.width || 1);
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(canvasRef.current);
    updateScale();
    return () => observer.disconnect();
  }, [pageData]);

  const handlePageClick = (event) => {
    if (!placement || !pageData) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const [x, y] = pageData.viewport.convertToPdfPoint(
      (event.clientX - bounds.left) / displayScale,
      (event.clientY - bounds.top) / displayScale,
    );
    onPlace({ page: pageNumber, x, y });
  };

  return (
    <div
      className={`official-forms__pdf-page${placement ? ' official-forms__pdf-page--placing' : ''}`}
      ref={containerRef}
      style={{
        width: pageData ? pageData.viewport.width * displayScale : undefined,
        minHeight: pageData ? pageData.viewport.height * displayScale : 980,
      }}
      onClick={handlePageClick}
    >
      <span className="official-forms__page-number">Page {pageNumber}</span>
      <canvas ref={canvasRef} />
      {pageData?.annotations.map((annotation, index) => {
        const status = fieldStatus(annotation.fieldName, mappings);
        const selected = selectedField === annotation.fieldName;
        return (
          <button
            type="button"
            key={`${annotation.fieldName}-${index}`}
            title={`${annotation.fieldName}${annotation.exportValue ? ` — ${annotation.exportValue}` : ''}${annotation.hint ? ` — near “${annotation.hint}”` : ''}`}
            className={`official-forms__field-box official-forms__field-box--${status}${selected ? ' official-forms__field-box--selected' : ''}`}
            style={{
              left: annotation.left * displayScale,
              top: annotation.top * displayScale,
              width: annotation.width * displayScale,
              height: annotation.height * displayScale,
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(annotation.fieldName, annotation.exportValue);
            }}
          >
            {annotation.exportValue && <span>{annotation.exportValue}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PdfViewer({ url, mappings, selectedField, placement, onSelect, onPlace }) {
  const [pdf, setPdf] = useState(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let active = true;
    setPdf(null);
    if (!url) return undefined;
    pdfjsLib.getDocument(url).promise.then((document) => {
      if (!active) return;
      setPdf(document);
      setPageCount(document.numPages);
    }).catch(() => {});
    return () => { active = false; };
  }, [url]);

  if (!url) return <p className="official-forms__muted">No PDF available.</p>;
  if (!pdf) return <p className="official-forms__muted">Loading PDF pages...</p>;
  return (
    <div className="official-forms__pdf-viewer" aria-label="Read-only PDF field viewer">
      {Array.from({ length: pageCount }, (_, index) => (
        <PdfPage
          key={index + 1}
          pdf={pdf}
          pageNumber={index + 1}
          mappings={mappings}
          selectedField={selectedField}
          placement={placement}
          onSelect={onSelect}
          onPlace={onPlace}
        />
      ))}
    </div>
  );
}

function MappingRow({ mapping, fields, sources, isFillable, selected, rowRef, onChange, onRemove, onSelect, onPlace }) {
  const target = fields.find((field) => field.name === mapping.pdfField);
  const options = target?.options || [];
  const rule = mapping.rule || {};
  const source = sources.find((item) => item.qKey === rule.qKey);
  const sourceOptions = source?.options || [];
  const updateRule = (changes) => onChange({
    ...mapping,
    rule: { ...rule, ...changes },
    reviewStatus: 'ok',
  });

  return (
    <div
      className={`official-forms__mapping-row${mapping.reviewStatus === 'needs_review' ? ' official-forms__mapping-row--review' : ''}${selected ? ' official-forms__mapping-row--selected' : ''}`}
      ref={rowRef}
      onClick={() => onSelect(mapping.pdfField)}
    >
      <label>
        PDF field
        <select value={mapping.pdfField || ''} onChange={(event) => onChange({ ...mapping, pdfField: event.target.value })}>
          <option value="">Select a field</option>
          {fields.map((field) => (
            <option key={field.name} value={field.name}>
              {field.name} ({field.type})
            </option>
          ))}
        </select>
      </label>
      <label>
        Source answer
        <select value={rule.qKey || ''} onChange={(event) => updateRule({ qKey: event.target.value })}>
          <option value="">Select a source</option>
          {sources.map((source) => (
            <option key={source.qKey} value={source.qKey}>{sourceLabel(source.qKey)}</option>
          ))}
        </select>
      </label>
      <label>
        Rule
        <select value={rule.type || 'direct'} onChange={(event) => updateRule({ type: event.target.value })}>
          <option value="direct">Direct copy</option>
          <option value="valueMap">Map values</option>
        </select>
      </label>
      {rule.type === 'valueMap' && (
        <div className="official-forms__option-map">
          <strong>Answer options</strong>
          {sourceOptions.length === 0 && <small>No options are defined for this source.</small>}
          {sourceOptions.map((option) => (
            <div key={String(option.value)} className="official-forms__option-row">
              <span>{option.label}</span>
              <div className="official-forms__option-controls">
                <select
                  value={target?.type === 'checkbox' && rule.values?.[String(option.value)] === true
                    ? CHECKBOX_VALUE
                    : options.includes(rule.values?.[String(option.value)])
                      ? rule.values[String(option.value)]
                      : (rule.values?.[String(option.value)] ? CUSTOM_TEXT_VALUE : '')}
                  onChange={(event) => {
                    const selected = event.target.value;
                    updateRule({
                      values: {
                        ...(rule.values || {}),
                        [String(option.value)]: selected === CHECKBOX_VALUE
                          ? true
                          : selected === CUSTOM_TEXT_VALUE
                          ? (options.includes(rule.values?.[String(option.value)] || '') ? '' : (rule.values?.[String(option.value)] || ''))
                          : selected,
                      },
                    });
                  }}
                >
                  <option value="">Leave blank</option>
                  {options.map((pdfOption) => <option key={pdfOption} value={pdfOption}>{pdfOption}</option>)}
                  {target?.type === 'checkbox' && <option value={CHECKBOX_VALUE}>Check box</option>}
                  {target?.type === 'text' && <option value={CUSTOM_TEXT_VALUE}>Text to input...</option>}
                </select>
                {target?.type === 'text' && (
                  <input
                    type="text"
                    value={options.includes(rule.values?.[String(option.value)]) ? '' : (rule.values?.[String(option.value)] || '')}
                    onChange={(event) => updateRule({
                      values: { ...(rule.values || {}), [String(option.value)]: event.target.value },
                    })}
                    placeholder="Text to input"
                    aria-label={`Text to input for ${option.label}`}
                  />
                )}
              </div>
            </div>
          ))}
          {options.length === 0 && target?.type !== 'text' && (
            <small>Target has no export values; enter them in the PDF field inventory.</small>
          )}
        </div>
      )}
      <div className="official-forms__mapping-meta">
        <span className={mapping.reviewStatus === 'needs_review' ? 'official-forms__flag' : 'official-forms__ok'}>
          {mapping.reviewStatus === 'needs_review' ? 'Needs review' : 'Ready'}
        </span>
        <button type="button" className="official-forms__icon-button" onClick={onRemove} aria-label={`Remove mapping for ${mapping.pdfField || 'field'}`}>
          <Trash2 size={16} />
        </button>
        {!isFillable ? (
          <button type="button" className="official-forms__icon-button" onClick={(event) => { event.stopPropagation(); onPlace(); }} aria-label="Place mapping on PDF">
            <MapPin size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SourcePalette({ sources, selectedSource, onSelect }) {
  const [search, setSearch] = useState('');
  const groups = useMemo(() => sources.reduce((result, source) => {
    const section = source.section || SECTION_LABELS.custom;
    if (!result[section]) result[section] = [];
    if (!search.trim() || sourceLabel(source.qKey).toLowerCase().includes(search.toLowerCase())) {
      result[section].push(source);
    }
    return result;
  }, Object.create(null)), [sources, search]);

  return (
    <aside className="official-forms__palette">
      <h2>Answer options</h2>
      <p className="official-forms__hint">Select an answer, then click a PDF box to place it.</p>
      <label className="official-forms__search">
        Search answers
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions" />
      </label>
      {Object.entries(groups).map(([section, sectionSources]) => (
        <section key={section} className="official-forms__source-section">
          <h3>{section}</h3>
          {sectionSources.map((source) => (
            <div key={source.qKey} className="official-forms__source-group">
              <button
                type="button"
                className={`official-forms__source-token${selectedSource?.qKey === source.qKey && !selectedSource.option ? ' official-forms__source-token--selected' : ''}`}
                onClick={() => onSelect({ qKey: source.qKey })}
              >
                {source.label || sourceLabel(source.qKey)}
              </button>
              {source.options?.length > 0 && (
                <div className="official-forms__source-options">
                  {source.options.map((option) => (
                    <button
                      type="button"
                      key={`${source.qKey}-${String(option.value)}`}
                      className={`official-forms__source-option${selectedSource?.qKey === source.qKey && selectedSource.option?.value === option.value ? ' official-forms__source-option--selected' : ''}`}
                      onClick={() => onSelect({ qKey: source.qKey, option })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </aside>
  );
}

export default function AdminOfficialForms() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [formId, setFormId] = useState(FORM_OPTIONS[0].id);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [detail, setDetail] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [file, setFile] = useState(null);
  const [revisionLabel, setRevisionLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sourcePdfUrl, setSourcePdfUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [samplePlanId, setSamplePlanId] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [placementIndex, setPlacementIndex] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const mappingRefs = useRef({});

  const sources = useMemo(() => [
    ...questions.filter((question) => !question.isArchived).map((question) => ({
      qKey: question.qKey,
      label: question.qTitle || question.qKey,
      options: question.options || [],
      section: sourceSection(question.qKey, question),
    })),
    ...Object.keys(CUSTOM_SOURCE_LABELS).map((qKey) => {
      const field = qKey.split('.').pop();
      const values = customOptionValues[field] || {};
      return {
        qKey,
        label: sourceLabel(qKey),
        section: sourceSection(qKey),
        options: Object.entries(values).map(([value, label]) => ({ value, label }))
          .concat(CUSTOM_COMPARISON_QUESTIONS[qKey]?.options || [])
          .filter((option, index, all) => all.findIndex((item) => String(item.value) === String(option.value)) === index),
      };
    }),
  ].filter((source, index, all) => all.findIndex((item) => item.qKey === source.qKey) === index), [questions]);

  const loadVersions = useCallback(async (activeUser, activeFormId) => {
    const result = await adminRequest(activeUser, `/official-forms/${activeFormId}/versions`);
    setVersions(result.versions || []);
    setSelectedVersion((current) => current && result.versions.some((version) => version._id === current)
      ? current
      : result.versions[0]?._id || null);
  }, []);

  const loadDetail = useCallback(async (activeUser, activeFormId, versionId) => {
    if (!versionId) {
      setDetail(null);
      return;
    }
    const result = await adminRequest(activeUser, `/official-forms/${activeFormId}/versions/${versionId}`);
    setDetail({
      ...result,
      mapping: result.mapping || { fields: [] },
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) navigate('/signin');
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      adminRequest(user, '/access'),
      adminRequest(user, '/questions'),
      loadVersions(user, formId),
    ]).then(([access, questionResult]) => {
      if (!active) return;
      if (!access.isAdmin) {
        setError('Administrator access required.');
        return;
      }
      setQuestions(questionResult.questions || []);
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user, formId, loadVersions]);

  useEffect(() => {
    if (!user || !selectedVersion) return;
    loadDetail(user, formId, selectedVersion).catch((requestError) => setError(requestError.message));
  }, [user, formId, selectedVersion, loadDetail]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!user || !selectedVersion) {
      setSourcePdfUrl('');
      return undefined;
    }
    user.getIdToken().then((token) => fetch(buildApiUrl(
      `/api/admin/official-forms/${formId}/versions/${selectedVersion}/pdf`,
    ), {
      headers: { Authorization: `Bearer ${token}` },
    })).then((response) => {
      if (!response.ok) throw new Error('Could not load PDF preview');
      return response.blob();
    }).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSourcePdfUrl(objectUrl);
    }).catch((previewError) => {
      if (active) setError(previewError.message);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user, formId, selectedVersion]);

  useEffect(() => {
    setPreviewMode(false);
    setSelectedField('');
    setSelectedSource(null);
    setPlacementIndex(null);
    setSamplePlanId('');
  }, [selectedVersion]);

  async function loadDraftPreview() {
    if (!samplePlanId.trim()) {
      setError('Enter a sample plan ID to preview a filled draft.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = await adminRequest(user, `/official-forms/${formId}/versions/${selectedVersion}/preview`, {
        method: 'POST',
        body: JSON.stringify({ planId: samplePlanId.trim() }),
        responseType: 'blob',
      });
      const blob = new Blob([body], { type: 'application/pdf' });
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewMode(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function selectField(fieldName) {
    setSelectedField(fieldName);
    mappingRefs.current[fieldName]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function placeSelectedSource(fieldName, exportValue = '') {
    if (!selectedSource || !fieldName) {
      selectField(fieldName);
      return;
    }
    const target = detail.version.fieldInventory.find((field) => field.name === fieldName);
    if (!target) return;
    const option = selectedSource.option;
    setDetail((current) => {
      const existingIndex = current.mapping.fields.findIndex((field) => field.pdfField === fieldName);
      const existing = existingIndex >= 0 ? current.mapping.fields[existingIndex] : {
        pdfField: fieldName,
        type: target.type === 'unknown' ? 'text' : target.type,
        reviewStatus: 'needs_review',
        rule: { type: 'direct', source: 'answer', qKey: selectedSource.qKey },
      };
      const nextRule = option
        ? {
          ...existing.rule,
          type: 'valueMap',
          source: 'answer',
          qKey: selectedSource.qKey,
          values: {
            ...(existing.rule?.values || {}),
            [String(option.value)]: target.type === 'checkbox' ? true : (exportValue || option.value),
          },
        }
        : { ...existing.rule, type: 'direct', source: 'answer', qKey: selectedSource.qKey };
      const next = { ...existing, rule: nextRule, reviewStatus: 'needs_review' };
      return {
        ...current,
        mapping: {
          ...current.mapping,
          fields: existingIndex >= 0
            ? current.mapping.fields.map((field, index) => index === existingIndex ? next : field)
            : [...current.mapping.fields, next],
        },
      };
    });
    selectField(fieldName);
    setNotice(`${sourceLabel(selectedSource.qKey)} placed on ${fieldName}.`);
  }

  function placeMapping(index, coordinates) {
    setDetail((current) => ({
      ...current,
      mapping: {
        ...current.mapping,
        fields: current.mapping.fields.map((field, fieldIndex) => fieldIndex === index
          ? { ...field, pdfField: null, overlay: coordinates, reviewStatus: 'needs_review' }
          : field),
      },
    }));
    setPlacementIndex(null);
  }

  function placeSelectedOverlay(coordinates) {
    if (placementIndex !== null) {
      placeMapping(placementIndex, coordinates);
      return;
    }
    if (!selectedSource) {
      setError('Select an answer option before placing it on a flat PDF.');
      return;
    }
    setDetail((current) => ({
      ...current,
      mapping: {
        ...current.mapping,
        fields: [...current.mapping.fields, {
          pdfField: null,
          overlay: coordinates,
          type: 'text',
          reviewStatus: 'needs_review',
          rule: {
            type: selectedSource.option ? 'valueMap' : 'direct',
            source: 'answer',
            qKey: selectedSource.qKey,
            ...(selectedSource.option ? {
              values: { [String(selectedSource.option.value)]: true },
            } : {}),
          },
        }],
      },
    }));
    setNotice(`${sourceLabel(selectedSource.qKey)} placed on the PDF.`);
  }

  function updateMapping(index, value) {
    setDetail((current) => ({
      ...current,
      mapping: {
        ...current.mapping,
        fields: current.mapping.fields.map((field, fieldIndex) => fieldIndex === index ? value : field),
      },
    }));
  }

  function addMapping() {
    if (!detail.version.isFillable) {
      setDetail((current) => ({
        ...current,
        mapping: {
          ...current.mapping,
          fields: [...current.mapping.fields, {
            pdfField: null,
            overlay: null,
            type: 'text',
            reviewStatus: 'needs_review',
            rule: { type: 'direct', source: 'answer', qKey: '' },
          }],
        },
      }));
      return;
    }
    const field = detail?.version?.fieldInventory?.find((candidate) =>
      !detail.mapping.fields.some((mapping) => mapping.pdfField === candidate.name));
    if (!field) {
      setError('Every PDF field already has a mapping.');
      return;
    }
    setDetail((current) => ({
      ...current,
      mapping: { ...current.mapping, fields: [...current.mapping.fields, makeMapping(field, current.version.isFillable)] },
    }));
  }

  async function saveMapping(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await adminRequest(user, `/official-forms/${formId}/versions/${selectedVersion}/mapping`, {
        method: 'PUT',
        body: JSON.stringify({ fields: detail.mapping.fields }),
      });
      await loadDetail(user, formId, selectedVersion);
      setNotice('Mapping saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadVersion(event) {
    event.preventDefault();
    if (!file || !revisionLabel.trim()) {
      setError('Choose a PDF and enter its revision label.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('pdf', file);
      body.append('revisionLabel', revisionLabel.trim());
      const result = await adminRequest(user, `/official-forms/${formId}/versions`, { method: 'POST', body });
      setRevisionLabel('');
      setFile(null);
      await loadVersions(user, formId);
      setSelectedVersion(result.version._id);
      setNotice('Draft version uploaded. Review its mappings before publishing.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function versionAction(action) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await adminRequest(user, `/official-forms/${formId}/versions/${selectedVersion}/${action}`, { method: 'POST' });
      await loadVersions(user, formId);
      await loadDetail(user, formId, selectedVersion);
      setNotice(action === 'publish' ? 'Version published.' : 'Version archived.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (!authReady || loading) return <main className="official-forms"><p>Loading official form administration...</p></main>;

  return (
    <main className="official-forms">
      <header className="official-forms__header">
        <div>
          <Link to="/admin" className="official-forms__back">Back to admin</Link>
          <h1>Official form mapping</h1>
          <p>Upload court form versions and map final plan answers without code changes.</p>
        </div>
        <Link to="/dashboard" className="official-forms__back">Back to dashboard</Link>
      </header>

      {error && <p className="official-forms__message official-forms__message--error" role="alert">{error}</p>}
      {notice && <p className="official-forms__message official-forms__message--success" role="status">{notice}</p>}

      <section className="official-forms__toolbar" aria-label="Form selection">
        <label>
          Form
          <select value={formId} onChange={(event) => setFormId(event.target.value)}>
            {FORM_OPTIONS.map((form) => <option key={form.id} value={form.id}>{form.label}</option>)}
          </select>
        </label>
      </section>

      <div className="official-forms__layout">
        <SourcePalette sources={sources} selectedSource={selectedSource} onSelect={setSelectedSource} />
        <section className="official-forms__panel">
          <h2>Versions</h2>
          <form className="official-forms__upload" onSubmit={uploadVersion}>
            <label>
              Revision label
              <input value={revisionLabel} onChange={(event) => setRevisionLabel(event.target.value)} placeholder="Amended YYYY-MM-DD" />
            </label>
            <label className="official-forms__file">
              <FileUp size={18} />
              <span>{file?.name || 'Choose PDF'}</span>
              <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <button type="submit" className="official-forms__primary" disabled={saving}><FileUp size={16} /> Upload draft</button>
          </form>
          <div className="official-forms__version-list">
            {versions.length === 0 && <p className="official-forms__muted">No versions uploaded yet.</p>}
            {versions.map((version) => (
              <button
                type="button"
                key={version._id}
                className={`official-forms__version${selectedVersion === version._id ? ' official-forms__version--selected' : ''}`}
                onClick={() => setSelectedVersion(version._id)}
              >
                <span><strong>{version.revisionLabel}</strong><small>{version.status} · uploaded {formatDate(version.createdAt)}</small></span>
                {version.status === 'active' && <CheckCircle2 size={18} aria-label="Active" />}
              </button>
            ))}
          </div>
        </section>

        <section className="official-forms__panel official-forms__editor">
          {!detail ? <p className="official-forms__muted">Select or upload a version to edit its mapping.</p> : (
            <>
              <div className="official-forms__editor-header">
                <div>
                  <h2>{detail.version.revisionLabel}</h2>
                  <p>{detail.version.isFillable ? 'AcroForm fields detected.' : 'Flat PDF: coordinate overlays require manual review.'}</p>
                </div>
                <div className="official-forms__actions">
                  {detail.version.status === 'draft' && (
                    <button type="button" className="official-forms__primary" onClick={() => versionAction('publish')} disabled={saving}><Send size={16} /> Publish</button>
                  )}
                  {detail.version.status !== 'active' && (
                    <button type="button" className="official-forms__secondary" onClick={() => versionAction('archive')} disabled={saving}><Archive size={16} /> Archive</button>
                  )}
                </div>
              </div>
              <DiffReport diff={detail.diff} />
              <div className="official-forms__preview-controls">
                <label>
                  Sample plan ID
                  <input value={samplePlanId} onChange={(event) => setSamplePlanId(event.target.value)} placeholder="Plan ID for draft preview" />
                </label>
                <button type="button" className="official-forms__secondary" onClick={loadDraftPreview} disabled={saving || detail.version.status !== 'draft'}>
                  {previewMode ? 'Refresh filled preview' : 'Preview filled draft'}
                </button>
                <button type="button" className="official-forms__secondary" onClick={() => setPreviewMode(false)}>
                  Show source PDF
                </button>
              </div>
              {(previewMode ? previewUrl : sourcePdfUrl) && (
                <PdfViewer
                  url={previewMode ? previewUrl : sourcePdfUrl}
                  mappings={detail.mapping?.fields || []}
                  selectedField={selectedField}
                  placement={placementIndex !== null}
                  onSelect={placeSelectedSource}
                  onPlace={placeSelectedOverlay}
                />
              )}
              <form onSubmit={saveMapping}>
                <div className="official-forms__mapping-heading">
                  <h3>Field mappings</h3>
                  <button type="button" className="official-forms__secondary" onClick={addMapping}>Add field mapping</button>
                </div>
                {detail.mapping?.fields?.length === 0 && <p className="official-forms__muted">No mappings yet. Add fields that have a questionnaire source.</p>}
                <div className="official-forms__mapping-list">
                  {(detail.mapping?.fields || []).map((mapping, index) => (
                    <MappingRow
                      key={`${mapping.pdfField || 'overlay'}-${index}`}
                      mapping={mapping}
                      fields={detail.version.fieldInventory}
                      sources={sources}
                      isFillable={detail.version.isFillable}
                      selected={selectedField === mapping.pdfField}
                      rowRef={(element) => { mappingRefs.current[mapping.pdfField || `mapping-${index}`] = element; }}
                      onSelect={selectField}
                      onPlace={() => setPlacementIndex(index)}
                      onChange={(value) => updateMapping(index, value)}
                      onRemove={() => setDetail((current) => ({
                        ...current,
                        mapping: { ...current.mapping, fields: current.mapping.fields.filter((_, fieldIndex) => fieldIndex !== index) },
                      }))}
                    />
                  ))}
                </div>
                <div className="official-forms__save-row">
                  <span>{NON_FINAL_VALUES.join(' and ')} answers are reported for attention during generation.</span>
                  <button type="submit" className="official-forms__primary" disabled={saving || detail.version.status === 'active'}><Save size={16} /> Save mapping</button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
