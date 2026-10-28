import { AimMarke } from '@/components/Marke';
import { Fusszeile } from '@/components/Fusszeile';
import { LoginFormular } from './LoginFormular';

export const metadata = { title: 'Anmelden' };

export default function LoginSeite() {
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 grid lg:grid-cols-[1.1fr_1fr]">
        <section className="hidden lg:flex flex-col justify-between bg-tiefblau text-white p-12 relative overflow-hidden">
          <AimMarke hell />
          <div className="max-w-md relative z-10">
            <p className="text-[13px] uppercase tracking-[0.18em] text-white/50 mb-4">AIM · Angebote in Minuten</p>
            <h1 className="text-[40px] leading-[1.05] font-semibold tracking-tight">Ihre Kalkulation.<br />Ihr Wissen.<br />Im System.</h1>
            <p className="mt-6 text-white/70 text-[15px] leading-relaxed">
              Werkstattzeichnungen, Ausschreibungen und Hallen in Minuten kalkuliert, mit Ihren Stundensätzen und Ihrem Kalkulationsschema. Jede Zahl nachvollziehbar, jede Freigabe bei Ihnen.
            </p>
          </div>
          <p className="text-[12px] text-white/40 relative z-10">Zugang nur für eingeladene Nutzer. Daten in Rechenzentren in Frankfurt am Main.</p>
          <svg className="absolute -right-24 -bottom-24 opacity-[0.07]" width="520" height="520" viewBox="0 0 100 100" aria-hidden>
            <path d="M10 85 L50 15 L90 85" fill="none" stroke="#fff" strokeWidth="2" />
            <path d="M22 85 L22 55 M36 85 L36 40 M50 85 L50 30 M64 85 L64 40 M78 85 L78 55" stroke="#fff" strokeWidth="1" />
          </svg>
        </section>
        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="lg:hidden mb-10"><AimMarke /></div>
            <h2 className="text-2xl font-semibold tracking-tight">Anmelden</h2>
            <p className="text-grau text-sm mt-1 mb-8">Mit Ihrer E-Mail-Adresse und Ihrem Passwort.</p>
            <LoginFormular />
          </div>
        </section>
      </main>
      <Fusszeile />
    </div>
  );
}
