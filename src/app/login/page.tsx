import { LoginForm } from "@/components/auth/login-form";
import "./login.css";
import "./login-switch.css";

export default function LoginPage() {
  return <main className="login-page"><div className="login-brand"><span>U</span><div><b>UKIHDP</b><small>Baseline assessment</small></div></div><LoginForm /></main>;
}
