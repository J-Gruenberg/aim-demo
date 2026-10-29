import Link from 'next/link';

export default function NichtGefunden() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="text-center">
        <p className="text-[14px] text-hell">Fehler 404</p>
        <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.02em]">Diese Seite gibt es nicht.</h1>
        <Link href="/" className="knopf-zweit mt-6">Zu den Kalkulationen</Link>
      </div>
    </main>
  );
}
