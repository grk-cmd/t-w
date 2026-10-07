import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { connectFirebase } from '@/shared/api';
import { App } from './App';
import { Providers } from './Providers';
import '../styles/global.css';

const root = createRoot(document.getElementById('root')!);

connectFirebase()
  .then((fb) =>
    root.render(
      <StrictMode>
        <Providers
          db={fb.db}
          files={fb.files}
          fns={fb.fns}
          env={{ isProd: fb.isProd, projectId: fb.projectId }}
        >
          <App fb={fb} />
        </Providers>
      </StrictMode>,
    ),
  )
  .catch((e: Error) =>
    root.render(
      <p className="center msg err">{e.message} — 이 페이지는 Firebase Hosting 주소에서만 열려요.</p>,
    ),
  );
