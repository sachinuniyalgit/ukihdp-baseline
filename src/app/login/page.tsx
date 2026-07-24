import { LoginForm } from "@/components/auth/login-form";
import "./login.css";

export default function LoginPage() {
  return <main className="login-page">
    <section className="login-story">
      <div className="login-brand"><span>F</span><div><b>FieldFlow</b><small>Field Data &amp; Assessment Platform</small></div></div>
      <div className="login-story-copy">
        <p>FieldFlow research platform</p>
        <h2>Evidence from the field.<br />Decisions with confidence.</h2>
        <span>Secure multi-study questionnaires, offline data collection, quality review, real GIS monitoring, and reusable research workflows.</span>
        <div className="login-story-stats"><b>∞<small>Studies</small></b><b>100%<small>Offline ready</small></b><b>GIS<small>Location enabled</small></b></div>
      </div>
      <p className="image-credit">FieldFlow secure research operations</p>
    </section>
    <section className="login-form-area"><LoginForm /></section>
  </main>;
}
