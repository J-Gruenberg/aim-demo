import Link from 'next/link';

export default function NichtGefunden() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="text-center">
        <p className="text-[14px] text-hell">Fehler 404</p>
        <h1 className="breit text-[28px] font-bold text-tiefblau mt-2">Diese Seite gibt es nicht.</h1>
        <Link href="/" className="knopf-zweit mt-6">Zu den Kalkulationen</Link>
      </div>
    </main>
  );
}
