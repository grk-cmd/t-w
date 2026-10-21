import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '@fontsource/dotgothic16/japanese-400.css';
import 'virtual:tw-tokens.css';
import './styles/site.css';
import { DEFAULT_LANG, isLang } from '@/shared/i18n';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root 가 없다');
// 언어는 미리 그린 페이지가 <html lang> 에 적어 둔 것 — 화면과 같은 언어로 이어 붙여야 hydrate 가 어긋나지 않는다
const docLang = document.documentElement.lang;
const lang = isLang(docLang) ? docLang : DEFAULT_LANG;
const app = (
  <StrictMode>
    <App lang={lang} />
  </StrictMode>
);
// 개발 서버는 미리 그리지 않아 빈 #root 다
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
