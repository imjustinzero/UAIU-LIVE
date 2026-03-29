export default function DeviceCertificationPage() {
  const suite = [
    "Connection and authentication",
    "Reading submission accuracy",
    "Signature verification",
    "Offline buffering and sync",
    "Timestamp accuracy",
    "Batch upload performance",
    "Error handling and recovery",
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 text-white">
      <h1 className="text-3xl font-bold">UAIU Device Certification Program</h1>
      <p className="mt-3 text-white/80">Manufacturers can submit devices for automated compatibility and reliability testing.</p>

      <h2 className="mt-8 text-xl font-semibold">How it works</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-white/90">
        <li>Submit model + firmware to <code>/api/devices/certification/apply</code>.</li>
        <li>UAIU executes the 7-point validation suite below.</li>
        <li>Passed devices receive Certified badge and top placement in matrix.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Automated test suite</h2>
      <ol className="mt-3 list-decimal space-y-1 pl-6 text-white/90">
        {suite.map((item) => <li key={item}>{item}</li>)}
      </ol>
    </div>
  );
}
