"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { loadOperationalRecords, type OperationalRecord } from "@/lib/insights/operational-data";
import { summarizeStudy, type StudySummary } from "@/lib/insights/summaries";
import { listStudies } from "@/lib/studies/study-catalog";
import type { StudyDefinition } from "@/lib/studies/types";

type ReportType = "full" | "executive" | "livelihoods" | "horticulture" | "value_chain" | "treatment_control" | "progress" | "indicators";

const reportTypes: Array<{ value: ReportType; label: string }> = [
  { value: "full", label: "Full baseline progress report" }, { value: "executive", label: "Executive summary" },
  { value: "livelihoods", label: "Livelihoods and household profile" }, { value: "horticulture", label: "Horticulture production report" },
  { value: "value_chain", label: "Value-chain and marketing report" }, { value: "treatment_control", label: "Treatment–control comparison" },
  { value: "progress", label: "Field collection progress" }, { value: "indicators", label: "Indicator summary" },
];

export function ReportsWorkspace() {
  const auth = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [studies, setStudies] = useState<StudyDefinition[]>([]);
  const [records, setRecords] = useState<OperationalRecord[]>([]);
  const [studyId, setStudyId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("full");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(today);
  const [warning, setWarning] = useState("");
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listStudies(), loadOperationalRecords({ testMode: auth.testMode, userId: auth.user?.id })]).then(([nextStudies, result]) => {
      if (cancelled) return;
      const active = nextStudies.filter((study) => study.status !== "archived");
      const requested = new URLSearchParams(window.location.search).get("study") ?? "";
      setStudies(active); setRecords(result.records); setWarning(result.warning); setStudyId(active.some((study) => study.id === requested) ? requested : active[0]?.id ?? "");
    }).catch((error) => { if (!cancelled) setWarning(error instanceof Error ? error.message : "Report data could not be loaded."); });
    return () => { cancelled = true; };
  }, [auth.testMode, auth.user?.id]);

  const study = studies.find((item) => item.id === studyId);
  const periodRecords = useMemo(() => records.filter((record) => record.studyId === studyId && (!startDate || record.updatedAt.slice(0, 10) >= startDate) && (!endDate || record.updatedAt.slice(0, 10) <= endDate)), [records, studyId, startDate, endDate]);
  const summary = useMemo(() => summarizeStudy(periodRecords, study), [periodRecords, study]);
  const reportLabel = reportTypes.find((item) => item.value === reportType)?.label ?? "Project report";
  const generatedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date());
  const periodLabel = startDate ? `${formatDate(startDate)} to ${formatDate(endDate)}` : `Up to ${formatDate(endDate)}`;

  async function exportPdf() {
    if (!study) return;
    setExporting("PDF");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      let y = 18;
      pdf.setTextColor(21, 55, 73); pdf.setFontSize(9); pdf.text("FIELDFLOW · AUTOMATIC STANDARD REPORT", 16, y); y += 8;
      pdf.setFontSize(17); pdf.text(reportLabel, 16, y, { maxWidth: 178 }); y += 14;
      pdf.setFontSize(10); pdf.setTextColor(55, 82, 94); pdf.text(study.fullName, 16, y, { maxWidth: 178 }); y += 12;
      pdf.setDrawColor(45, 132, 123); pdf.line(16, y, 194, y); y += 8;
      y = addPdfLines(pdf, [["Reporting period", periodLabel], ["Generated", generatedDate], ["Approved records", String(summary.approved)], ["Collection progress", `${summary.completion}%`]], y);
      y = addPdfSection(pdf, "Executive progress summary", factualNarrative(summary, study), y);
      y = addPdfSection(pdf, "Sample coverage", `Treatment households approved: ${summary.treatment} of ${study.treatmentTarget ?? "target not set"}. Control households approved: ${summary.control} of ${study.controlTarget ?? "target not set"}.`, y);
      y = addPdfSection(pdf, "District progress", summary.districts.map((district) => `${district.name}: ${district.approved} approved, ${district.total} collected`).join("\n") || "No district records are available for this reporting period.", y);
      y = addPdfSection(pdf, "Key verified indicators", indicatorNarrative(summary), y);
      y = addPdfSection(pdf, "Data quality and next actions", qualityNarrative(summary), y);
      pdf.setFontSize(7); pdf.setTextColor(120); pdf.text("Generated automatically from FieldFlow records. Narrative is factual and based only on stored data.", 16, 286);
      pdf.save(`${safeName(study.code)}-${reportType}-${endDate}.pdf`);
    } finally { setExporting(""); }
  }

  async function exportDocx() {
    if (!study) return;
    setExporting("Word");
    try {
      const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, WidthType } = await import("docx");
      const rows = summary.districts.map((district) => new TableRow({ children: [new TableCell({ children: [new Paragraph(district.name)] }), new TableCell({ children: [new Paragraph(String(district.total))] }), new TableCell({ children: [new Paragraph(String(district.approved))] })] }));
      const document = new Document({ sections: [{ children: [
        new Paragraph({ text: "FIELDFLOW · AUTOMATIC STANDARD REPORT" }),
        new Paragraph({ text: reportLabel, heading: HeadingLevel.TITLE }),
        new Paragraph({ text: study.fullName, heading: HeadingLevel.HEADING_2 }),
        new Paragraph(`Reporting period: ${periodLabel}`), new Paragraph(`Generated: ${generatedDate}`),
        new Paragraph({ text: "Executive progress summary", heading: HeadingLevel.HEADING_1 }), new Paragraph(factualNarrative(summary, study)),
        new Paragraph({ text: "Sample coverage", heading: HeadingLevel.HEADING_1 }), new Paragraph(`Treatment households approved: ${summary.treatment} of ${study.treatmentTarget ?? "target not set"}. Control households approved: ${summary.control} of ${study.controlTarget ?? "target not set"}.`),
        new Paragraph({ text: "District progress", heading: HeadingLevel.HEADING_1 }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: [new TableCell({ children: [new Paragraph("District")] }), new TableCell({ children: [new Paragraph("Collected")] }), new TableCell({ children: [new Paragraph("Approved")] })] }), ...rows] }),
        new Paragraph({ text: "Key verified indicators", heading: HeadingLevel.HEADING_1 }), new Paragraph(indicatorNarrative(summary)),
        new Paragraph({ text: "Data quality and next actions", heading: HeadingLevel.HEADING_1 }), new Paragraph(qualityNarrative(summary)),
        new Paragraph("Generated automatically from FieldFlow records. Narrative is factual and based only on stored data."),
      ] }] });
      downloadBlob(await Packer.toBlob(document), `${safeName(study.code)}-${reportType}-${endDate}.docx`);
    } finally { setExporting(""); }
  }

  return <AccessGate roles={["admin", "researcher", "reviewer"]}>
    <main className="insights-page">
      <header className="insights-topbar"><div><Link href="/">FieldFlow</Link><span>Automatic Reports</span></div><b>Single source of truth</b></header>
      <section className="insights-heading"><div><p>Reporting centre</p><h1>Automatic Standard Reports</h1><span>Select a study and period. Tables, indicators, and narrative come from saved survey data.</span></div></section>
      {warning && <p className="insights-warning">Some central data could not be loaded: {warning}. Device records remain visible.</p>}
      <section className="report-builder">
        <aside className="report-controls"><h2>Report setup</h2><p>No quantitative re-entry is needed. Approved survey data is reused automatically.</p>
          <label>Study<select value={studyId} onChange={(event) => setStudyId(event.target.value)}>{studies.map((item) => <option key={item.id} value={item.id}>{item.shortName}</option>)}</select></label>
          <label>Report type<select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}>{reportTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Start date (optional)<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>End date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <div className="report-actions"><button disabled={!study || Boolean(exporting)} onClick={() => void exportPdf()}>{exporting === "PDF" ? "Preparing…" : "Export PDF"}</button><button className="secondary" disabled={!study || Boolean(exporting)} onClick={() => void exportDocx()}>{exporting === "Word" ? "Preparing…" : "Export Word"}</button><button className="secondary" onClick={() => window.print()}>Print preview</button><button className="secondary" onClick={() => window.location.href = "/analytics"}>Open analytics</button></div>
        </aside>
        <article className="report-preview"><ReportPreview study={study} summary={summary} reportLabel={reportLabel} periodLabel={periodLabel} generatedDate={generatedDate} /></article>
      </section>
    </main>
  </AccessGate>;
}

function ReportPreview({ study, summary, reportLabel, periodLabel, generatedDate }: { study?: StudyDefinition; summary: StudySummary; reportLabel: string; periodLabel: string; generatedDate: string }) {
  if (!study) return <div className="chart-empty">Choose an available study to generate a report.</div>;
  return <div className="report-document"><header><span>FieldFlow automatic standard report</span><h1>{reportLabel}</h1><p>{study.fullName}</p><p>{periodLabel} · Generated {generatedDate}</p></header>
    <div className="report-summary-grid"><ReportStat label="Target sample" value={summary.target || "—"} /><ReportStat label="Collected" value={summary.total} /><ReportStat label="Approved" value={summary.approved} /><ReportStat label="Progress" value={`${summary.completion}%`} /></div>
    <h2>Executive progress summary</h2><p>{factualNarrative(summary, study)}</p>
    <h2>Treatment and control coverage</h2><table className="report-table"><thead><tr><th>Sample group</th><th>Approved</th><th>Target</th><th>Achievement</th></tr></thead><tbody><tr><td>Treatment</td><td>{summary.treatment}</td><td>{study.treatmentTarget ?? "—"}</td><td>{rate(summary.treatment, study.treatmentTarget)}%</td></tr><tr><td>Control</td><td>{summary.control}</td><td>{study.controlTarget ?? "—"}</td><td>{rate(summary.control, study.controlTarget)}%</td></tr></tbody></table>
    <h2>District progress</h2><table className="report-table"><thead><tr><th>District</th><th>Collected</th><th>Approved</th></tr></thead><tbody>{summary.districts.map((district) => <tr key={district.name}><td>{district.name}</td><td>{district.total}</td><td>{district.approved}</td></tr>)}</tbody></table>
    <h2>Key verified indicators</h2><p>{indicatorNarrative(summary)}</p>
    <h2>Data quality and next actions</h2><p>{qualityNarrative(summary)}</p>
    <p className="report-footnote">Generated automatically from FieldFlow records. The narrative reports only values supported by stored data; explanations and conclusions are not invented.</p>
  </div>;
}

function ReportStat({ label, value }: { label: string; value: string | number }) { return <div><span>{label}</span><b>{value}</b></div>; }
function factualNarrative(summary: StudySummary, study: StudyDefinition) { return `During the selected reporting period, ${summary.total} survey record${summary.total === 1 ? " was" : "s were"} available for ${study.shortName}. ${summary.approved} records were approved, ${summary.submitted + summary.underReview} were awaiting or undergoing review, ${summary.returned} were returned for correction, and ${summary.draft + summary.pendingSync} remained in draft or pending synchronization. Approved completion is ${summary.completion}% of the configured target of ${summary.target || "no target"}.`; }
function indicatorNarrative(summary: StudySummary) { const values = [summary.avgIncome ? `average annual household income was ₹${summary.avgIncome.toLocaleString("en-IN")}` : "annual household income was not yet available", summary.avgHouseholdSize ? `average household size was ${summary.avgHouseholdSize}` : "household size was not yet available", summary.avgDietaryGroups ? `the average recorded dietary diversity was ${summary.avgDietaryGroups} food groups` : "dietary diversity was not yet available", `${summary.fpoMembers} approved households reported FPO membership`]; return `Among approved records, ${values.join(", ")}.`; }
function qualityNarrative(summary: StudySummary) { return `${summary.missingGps} records lacked GPS coordinates, ${summary.poorGps} had reported GPS accuracy above 50 metres, and ${summary.returned} were returned for correction. These records should be checked before final analysis.`; }
function rate(value: number, target?: number) { return target ? Math.min(100, Math.round(value / target * 1000) / 10) : 0; }
function formatDate(value: string) { if (!value) return "Not specified"; return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)); }
function safeName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function downloadBlob(blob: Blob, fileName: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
function addPdfLines(pdf: import("jspdf").jsPDF, lines: Array<[string, string]>, startY: number) { let y = startY; pdf.setFontSize(9); lines.forEach(([label, value]) => { pdf.setTextColor(90); pdf.text(label, 16, y); pdf.setTextColor(32, 63, 76); pdf.text(value, 60, y); y += 6; }); return y + 2; }
function addPdfSection(pdf: import("jspdf").jsPDF, title: string, body: string, startY: number) { let y = startY; if (y > 245) { pdf.addPage(); y = 18; } pdf.setTextColor(26, 72, 83); pdf.setFontSize(12); pdf.text(title, 16, y); y += 6; pdf.setTextColor(65, 88, 98); pdf.setFontSize(9); const lines = pdf.splitTextToSize(body, 178) as string[]; pdf.text(lines, 16, y); return y + lines.length * 4.5 + 7; }
