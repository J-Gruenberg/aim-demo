import { Calculator, FileCheck, FileScan, type LucideIcon } from 'lucide-react';
import { AimMarke } from '@/components/Marke';
import { Fusszeile } from '@/components/Fusszeile';
import { LoginFormular } from './LoginFormular';

export const metadata = { title: 'Anmelden' };

const SCHRITTE: { icon: LucideIcon; titel: string; text: string }[] = [
  { icon: FileScan, titel: 'Zeichnung ablegen', text: 'PDF, Scan oder Foto. AIM liest Stückliste, Bohrungen und Nähte.' },
  { icon: Calculator, titel: 'Mit Ihren Sätzen gerechnet', text: 'Kostenstellen, Zuschläge und Materialpreise aus Ihrem Betrieb.' },
  { icon: FileCheck, titel: 'Prüfen und abschicken', text: 'Jede Zahl nachvollziehbar, jede Freigabe bei Ihnen.' },
];

export default function LoginSeite() {
  return (
    <div className="aim-flaeche flex min-h-schirm flex-col">
      <main className="grid flex-1 gap-6 p-4 md:p-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="aim-hero relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-12">
          <AimMarke hell />
          <div className="max-w-[34rem]">
            <h1 className="text-[44px] font-extrabold leading-[1.08] tracking-[-0.025em] xl:text-[48px]">Aus der Zeichnung wird das Angebot.</h1>
            <p className="mt-4 text-[20px] leading-[1.4] text-white/85">Angebote in Minuten für Stahl- und Metallbau.</p>
            <ul className="mt-9 flex flex-col gap-5">
              {SCHRITTE.map((s) => (
                <li key={s.titel} className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15"><s.icon className="size-5" strokeWidth={1.75} aria-hidden /></span>
                  <span>
                    <span className="block text-[16px] font-bold">{s.titel}</span>
                    <span className="block text-[15px] text-white/75">{s.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[13px] text-white/60">Zugang nur für eingeladene Nutzer.</p>
        </section>
        <section className="flex items-center justify-center py-10">
          <div className="karte w-full max-w-[420px] p-7 sm:p-9">
            <div className="mb-8 lg:hidden"><AimMarke /></div>
            <h2 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Anmelden</h2>
            <p className="mb-7 mt-2 text-[15px] text-ink-600">Mit Ihrer E-Mail-Adresse und Ihrem Passwort.</p>
            <LoginFormular />
          </div>
        </section>
      </main>
      <Fusszeile ohneAbstand />
    </div>
  );
}
