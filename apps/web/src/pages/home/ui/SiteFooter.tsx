import { HELP_URL, PRIVACY_URL } from '@/shared/config';
import { useI18n } from '@/shared/i18n';

export function SiteFooter() {
  const { m } = useI18n();
  return (
    <footer className="foot">
      <div className="wrap">
        <span>© Together Working</span>
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          {m.footerPrivacy}
        </a>
        <a href={HELP_URL} target="_blank" rel="noopener noreferrer">
          {m.footerHelp}
        </a>
      </div>
    </footer>
  );
}
