import { Info } from 'lucide-react';
import './HelpMenu.css';

export default function HelpMenu({ text }) {
    const hasHelpText = typeof text === 'string'
        ? text.trim().length > 0 && text.trim().toLowerCase() !== 'blank'
        : Boolean(text);
    if (!hasHelpText) return null;

    return (
        <span className="help-menu">
            <span className="help-menu__content">
                <Info size={15} />
                <span>{text}</span>
            </span>
        </span>
    );
}