import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCheck, Clock3, Globe2, MousePointer2, Pin, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import './welcome.css';

// A self-contained preview: clicking here never reads or changes another browser tab.
const examples = [
  {name:'Maya Chen',email:'maya.chen@example.com',project:'Cedar'},
  {name:'Adam Parker',email:'adam.parker@example.com',project:'Meadow'},
  {name:'Lina Martin',email:'lina.martin@example.com',project:'Willow'},
  {name:'Noah Wilson',email:'noah.wilson@example.com',project:'Orchard'},
];
function Welcome() {
  const [round,setRound]=useState(-1);
  const sample=round<0?null:examples[round%examples.length];
  return <div className="welcome-shell">
    <header className="welcome-header">
      <a className="welcome-brand" href="./welcome.html" aria-label="Formly welcome"><img src="./icons/icon-128.png" alt="" width="42" height="42"/>formly<span>YOUR FORM, FILLED.</span></a>
      <a className="settings-link" href="./index.html">Open settings <ArrowUpRight size={16}/></a>
    </header>
    <main>
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <span className="installed-label"><Check size={13}/> YOU’RE ALL SET</span>
          <h1 id="welcome-title">Less typing.<br/><span>More testing.</span></h1>
          <p className="hero-description">Meet your new form-filling sidekick. Fresh names, emails, and meaningful test data for the page you’re on. All in one click.</p>
          <div className="hero-actions"><a className="welcome-primary" href="#quick-start">Let’s get started <ArrowDown size={17}/></a><span>No account needed.<br/>{' '}Gemini is optional.</span></div>
          <div className="hero-languages"><Globe2 size={16}/><span>English</span><i/><span>Français</span><i/><span lang="ar" dir="rtl">العربية</span></div>
        </div>
        <div className="preview-stage">
          <div className="preview-note"><span/> ONE CLICK. A FRESH START.</div>
          <section className="preview-browser" aria-label="Interactive form preview">
            <div className="preview-toolbar"><div className="window-dots"><i/><i/><i/></div><span>your-next-project.test</span><img src="./icons/icon-32.png" alt="Formly toolbar icon" width="26" height="26"/></div>
            <div className="preview-content">
              <span className="preview-eyebrow">A LITTLE PRACTICE</span><h2>Your next great project</h2><p>Try a fill. Click again to change the data.</p>
              <div className={`preview-fields ${sample?'is-filled':''}`}>
                <label>Full name<input readOnly value={sample?.name??''} placeholder="Your name"/></label>
                <label>Email address<input readOnly value={sample?.email??''} placeholder="you@example.com" type="email"/></label>
                <label>Project name<input readOnly value={sample?.project??''} placeholder="Something good starts here"/></label>
              </div>
              <button className="preview-fill" onClick={()=>setRound(current=>current+1)}><Sparkles size={17}/>{sample?'Fill again':'Try a fill'}<MousePointer2 size={17}/></button>
              <div className="preview-feedback" role="status">{sample?<><CheckCheck size={14}/> 3 fields filled · try another set</>:<><ShieldCheck size={14}/> A safe preview. Nothing is submitted.</>}</div>
            </div>
          </section>
          <div className="preview-caption"><span className="caption-line"/> Small click. Big time-saver.</div>
        </div>
      </section>
      <section id="quick-start" className="quick-start" aria-labelledby="start-title">
        <div className="section-label"><span>THE 20-SECOND SETUP</span><h2 id="start-title">Three steps to your first fill.</h2></div>
        <ol className="steps">
          <li><div className="step-top"><Pin size={21}/><span>01</span></div><h3>Pin your sidekick</h3><p>Open the browser’s Extensions menu and pin Formly to your toolbar.</p></li>
          <li><div className="step-top"><Globe2 size={21}/><span>02</span></div><h3>Find a form</h3><p>Open a website you’re testing. Names, addresses, dropdowns — bring them on.</p></li>
          <li><div className="step-top"><MousePointer2 size={21}/><span>03</span></div><h3>Click. Filled.</h3><p>Click the Formly icon. Click again for fresh data. Right-click → Open Formly panel to inspect fields and undo. You decide when to submit.</p></li>
        </ol>
      </section>
      <section className="make-yours" aria-labelledby="yours-title">
        <div className="section-label"><span>A LITTLE MORE YOU</span><h2 id="yours-title">Your forms. Your rules.</h2><p>Ready out of the box, with room to make it yours.</p></div>
        <div className="feature-links">
          <a href="./index.html#gemini"><Sparkles size={22}/><h3>Give unfamiliar fields context</h3><p>Add a Gemini key to prepare relevant suggestions as forms appear, including dialogs. Filling still waits for your click.</p><span>Set up Gemini <ArrowUpRight size={16}/></span></a>
          <a href="./index.html#excluded"><SlidersHorizontal size={22}/><h3>Keep the right fields untouched</h3><p>Search and navigation controls are skipped by default. Add your own exclusions for any website.</p><span>Choose exclusions <ArrowUpRight size={16}/></span></a>
          <a href="./index.html#cache"><Clock3 size={22}/><h3>Set the pace of your cache</h3><p>Keep suggestions for 1–60 minutes, or clear them whenever you like. Five minutes is the starting point.</p><span>Manage your cache <ArrowUpRight size={16}/></span></a>
        </div>
      </section>
      <aside className="welcome-bottom"><div><ShieldCheck size={24}/><p><strong>You stay in control.</strong><span>Local generation works offline. Gemini shares field descriptions with Google only when you enable it. Filling never submits forms automatically.</span></p></div><a className="welcome-primary" href="./index.html">Make it yours <ArrowRight size={17}/></a></aside>
    </main>
    <footer className="welcome-footer"><span>Made for the work between “build” and “ship”.</span><span>Formly · Chrome & Edge</span></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Welcome/>);
