import { AimMarke } from '@/components/Marke';
import { Fusszeile } from '@/components/Fusszeile';
import { LoginFormular } from './LoginFormular';

export const metadata = { title: 'Anmelden' };

export default function LoginSeite() {
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 grid lg:grid-cols-[1.15fr_1fr]">
        <section className="hidden lg:flex flex-col justify-between bg-tiefblau text-white p-12 relative overflow-hidden">
          <AimMarke hell />
          <Werkstattzeichnung />
          <div className="max-w-[30rem] relative">
            <h1 className="breit text-[44px] leading-[1.04] font-bold">Aus der Zeichnung wird das Angebot.</h1>
            <p className="mt-5 text-white/75 text-[16px] leading-relaxed max-w-[52ch]">
              AIM liest Werkstattzeichnungen, Ausschreibungen und Hallenanfragen und rechnet mit Ihren Stundensätzen und Ihrem Kalkulationsschema. Jede Zahl nachvollziehbar, jede Freigabe bei Ihnen.
            </p>
          </div>
          <p className="text-[13px] text-white/45 relative">Zugang nur für eingeladene Nutzer. Daten in Rechenzentren in Frankfurt am Main.</p>
        </section>
        <section className="flex items-center justify-center p-6 raster lg:bg-none lg:bg-papier">
          <div className="w-full max-w-sm bg-flaeche lg:bg-transparent rounded-[6px] p-6 lg:p-0 border border-linie lg:border-0">
            <div className="lg:hidden mb-8"><AimMarke /></div>
            <h2 className="breit text-[28px] font-bold text-tiefblau">Anmelden</h2>
            <p className="text-grau text-[15px] mt-1 mb-8">Mit Ihrer E-Mail-Adresse und Ihrem Passwort.</p>
            <LoginFormular />
          </div>
        </section>
      </main>
      <Fusszeile ohneAbstand />
    </div>
  );
}

/** Konstruktionsskizze einer Stütze mit Kopf- und Fußplatte, Maßketten und Positionsballons. */
function Werkstattzeichnung() {
  return (
    <svg className="absolute right-[-150px] xl:right-[-60px] top-[70px] w-[540px] opacity-[0.2] pointer-events-none" viewBox="0 0 560 520" aria-hidden>
      <g fill="none" stroke="#fff" strokeLinecap="round">
        {/* Stütze in der Ansicht */}
        <g strokeWidth="1.8">
          <rect x="190" y="70" width="120" height="16" />
          <rect x="190" y="424" width="120" height="16" />
          <path d="M205 86 V424 M295 86 V424 M218 86 V424 M282 86 V424" />
        </g>
        <g strokeWidth="1.1">
          <circle cx="205" cy="78" r="4" /><circle cx="295" cy="78" r="4" />
          <circle cx="205" cy="432" r="5" /><circle cx="295" cy="432" r="5" />
          <path d="M250 50 V460" strokeDasharray="14 4 2 4" />
        </g>
        {/* Maßketten */}
        <g strokeWidth="1">
          <path d="M150 70 V440 M142 70 H170 M142 440 H170" />
          <path d="M146 74 L154 66 M146 444 L154 436" />
          <path d="M190 480 H310 M190 472 V488 M310 472 V488" />
          <path d="M186 484 L194 476 M306 484 L314 476" />
        </g>
        {/* Positionsballons mit Hinweislinien */}
        <g strokeWidth="1.3">
          <circle cx="400" cy="120" r="20" />
          <path d="M382 128 L310 80" />
          <circle cx="410" cy="300" r="20" />
          <path d="M390 300 L295 300" />
          <circle cx="400" cy="470" r="20" />
          <path d="M382 462 L310 434" />
        </g>
      </g>
      <g fill="#fff" fontFamily="Archivo Variable, sans-serif" fontWeight="700" fontSize="17" textAnchor="middle">
        <text x="400" y="126">1</text>
        <text x="410" y="306">2</text>
        <text x="400" y="476">3</text>
      </g>
      <g fill="#fff" fontFamily="Archivo Variable, sans-serif" fontSize="14" textAnchor="middle">
        <text x="128" y="260" transform="rotate(-90 128 260)">4200</text>
        <text x="250" y="505">300</text>
      </g>
    </svg>
  );
}
