import { LoginForm } from "@/components/auth/login-form";
import "./login.css";

export default function LoginPage() {
  return <main className="login-page">
    <section className="login-story">
      <div className="login-brand"><span>U</span><div><b>UKIHDP</b><small>Baseline assessment</small></div></div>
      <div className="login-story-copy">
        <p>FieldFlow research platform</p>
        <h2>Evidence from the field.<br />Decisions for the mountains.</h2>
        <span>Secure household surveys, offline data collection, quality review and project monitoring across 16 FPO clusters.</span>
        <div className="login-story-stats"><b>4<small>Districts</small></b><b>16<small>FPO clusters</small></b><b>960<small>Households</small></b></div>
      </div>
      <p className="image-credit">Uttarakhand Himalayan field research</p>
    </section>
    <section className="login-form-area"><LoginForm /></section>
  </main>;
}
