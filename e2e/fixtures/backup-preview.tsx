// Isolated UI fixture: no Privy session, secrets or external email requests.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import BackupSignInDialog from '../../src/backup-signin-dialog';
import '../../src/styles.css';import '../../src/monad.css';import '../../src/account-dialog.css';import '../../src/community-pages.css';
function Preview(){const [open,setOpen]=useState(false),[email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[error,setError]=useState('');return <><button onClick={()=>setOpen(true)}>Open backup sign in</button>{open&&<BackupSignInDialog email={email} code={code} sent={sent} sending={false} error={error} onEmail={setEmail} onCode={setCode} onClose={()=>setOpen(false)} onReset={()=>{setSent(false);setCode('');setError('');}} onSubmit={e=>{e.preventDefault();if(!sent){setSent(true);setError('');}else if(code==='123456')setOpen(false);else setError('The code could not be accepted. Check it or request a new code.');}}/>}</>};
createRoot(document.getElementById('root')!).render(<Preview/>);
