import Image from "next/image";

export default function AccountingFlowchartPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl font-bold mb-6">Accounting Full Flowchart</h1>
      <div className="w-full max-w-4xl">
        <Image
          src="/notes/accounting-flowchart.png"
          alt="Accounting Full Flowchart"
          width={1200}
          height={800}
          className="rounded shadow-lg w-full h-auto"
          priority
        />
      </div>
    </main>
  );
}
