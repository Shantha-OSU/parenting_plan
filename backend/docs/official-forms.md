# Official Ohio form generation

Official Form 20 and Form 21 PDFs are stored as MongoDB binary data in
`OfficialFormVersion` documents. They are never downloaded from the court at
request time. Each uploaded version has its own field inventory and mapping;
publishing archives the previous active version for that form.
Active mappings are immutable through the mapping endpoint; upload a new PDF
version to obtain a draft before changing mappings.

Administrators use:

- `POST /api/admin/official-forms/:formId/versions` with a `pdf` multipart
  field and `revisionLabel`
- `GET` and `PUT` mapping/version routes under the same prefix
- `POST .../versions/:versionId/publish` and `.../archive`
- `GET .../versions/:versionId/coverage`

`POST /api/plan/:planId/official-form/:formId` returns a filled PDF. Shared
plans are generated only after their case is `resolved`, using
`Case.mergedAnswers`; an individual plan without a case uses its own answers.
The response headers identify the version and include a JSON report of fields
whose answers need attention. The packet route appends a generated schedule
attachment and reports the child-support worksheet as not included.

Run `node scripts/inspect-pdf-fields.js <pdf>` to inspect AcroForm fields.
Run `node scripts/seed-official-forms.js` after placing the court PDFs at
`backend/assets/official-forms/form-20.pdf` and `form-21.pdf`. The repository
does not contain those source PDFs, so the seed script intentionally fails
with a missing-file error until they are supplied.

Flat PDFs use coordinate overlays. Coordinate mappings are never carried to a
new version as reviewed mappings; they are carried only as `needs_review`.
