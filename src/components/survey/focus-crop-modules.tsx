"use client";

import { useEffect, useMemo } from "react";
import type { CropMasterRecord } from "@/config/crop-master";
import type { AdminMasterData } from "@/lib/admin-master-data";

type DataRecord = Record<string, unknown>;

interface FocusCropModulesProps {
  matchedCropNames: string[];
  value: DataRecord[];
  update: (value: DataRecord[]) => void;
  masterData: AdminMasterData;
  draftId: string;
}

const AREA_UNITS = ["Nali", "Acre", "Hectare"];
const PRODUCTION_UNITS = ["kg", "Quintal", "Metric Tonne", "Other - Specify"];
const SEASONS = ["Kharif", "Rabi", "Zaid / Summer", "Other - Specify"];
const VARIETY_TYPES = ["Local / Traditional", "Improved", "Hybrid", "Other - Specify", "Don't Know"];
const PLANTING_SOURCES = ["FPO", "Government Department", "Government Nursery", "Private Nursery", "Private Dealer", "Own Farm", "Other Farmer", "SHG / Farmer Group", "Other - Specify", "Don't Know"];
const PRACTICES = ["Fertilizer use", "Pesticide use", "Irrigation", "Mulching", "IPM", "INM", "Polyhouse", "Shade Net", "Drip Irrigation", "Sprinkler Irrigation", "Other - Specify", "None"];
const CONSTRAINTS = ["Pest", "Disease", "Water shortage", "Irrigation constraints", "Labour shortage", "High labour cost", "Lack of quality planting material", "High input cost", "Poor input availability", "Weather/climate-related problems", "Wild animal damage", "Limited technical knowledge", "Market access", "Low/unstable prices", "Other - Specify", "No major constraint"];
const COST_FIELDS = [
  ["plantingMaterial", "Planting material"],
  ["fertilizer", "Fertilizer"],
  ["manureCompost", "Manure / compost"],
  ["pesticideFungicide", "Pesticide / fungicide"],
  ["irrigation", "Irrigation"],
  ["machineryEquipment", "Machinery / equipment"],
  ["hiredLabour", "Hired labour"],
  ["familyLabourValuation", "Family labour valuation (if approved)"],
  ["other", "Other cost"],
] as const;

const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const numeric = (value: unknown) => typeof value === "number" ? value : Number(value) || 0;

function emptyModule(crop: CropMasterRecord, draftId: string): DataRecord {
  return {
    focusCropId: `${draftId}-FOCUS-${slug(crop.name)}`,
    cropMasterId: crop.id,
    cropName: crop.name,
    cropCategory: crop.category,
    cropType: crop.cropType,
    classificationStatus: crop.status,
    cycleCount: "",
    customCycleCount: "",
    cycles: [],
    orchard: {},
  };
}

function emptyCycle(focusCropId: string, index: number): DataRecord {
  return {
    cropCycleId: `${focusCropId}-CYCLE-${index + 1}`,
    season: "",
    otherSeason: "",
    areaPlanted: { value: "", unit: "Nali" },
    areaHarvested: { value: "", unit: "Nali" },
    production: { value: "", unit: "kg" },
    varieties: [],
    otherVariety: "",
    varietyType: "",
    plantingMaterialSource: "",
    otherPlantingMaterialSource: "",
    practices: [],
    otherPractice: "",
    costs: {},
    familyLabourPersonDays: "",
    otherCostDescription: "",
    constraints: [],
    otherConstraint: "",
  };
}

function cycleNumber(module: DataRecord) {
  if (module.cycleCount === "More than 3") return Math.max(0, Math.min(12, numeric(module.customCycleCount)));
  return Math.max(0, Math.min(3, numeric(module.cycleCount)));
}

function areaInAcres(area: DataRecord, masterData: AdminMasterData): number | null {
  const value = numeric(area.value);
  if (!value) return null;
  if (area.unit === "Acre") return value;
  if (area.unit === "Hectare") return value * 2.47105;
  if (area.unit === "Nali") {
    const conversion = masterData.landUnitConversion;
    if (conversion.status !== "Confirmed" || conversion.value.naliToAcre === null) return null;
    return value * conversion.value.naliToAcre;
  }
  return null;
}

function productionInKg(production: DataRecord): number | null {
  const value = numeric(production.value);
  if (!value) return null;
  if (production.unit === "kg") return value;
  if (production.unit === "Quintal") return value * 100;
  if (production.unit === "Metric Tonne") return value * 1000;
  return null;
}

function productivity(area: DataRecord, production: DataRecord, masterData: AdminMasterData) {
  const acres = areaInAcres(area, masterData);
  const kilograms = productionInKg(production);
  if (area.unit === "Nali" && masterData.landUnitConversion.status !== "Confirmed") return "Pending approved Nali conversion factor";
  if (!acres || !kilograms) return "Enter harvested area and production to calculate";
  const perAcre = kilograms / acres;
  return `${perAcre.toFixed(1)} kg/acre | ${(perAcre * 2.47105).toFixed(1)} kg/ha`;
}

function totalCost(costs: DataRecord) {
  return COST_FIELDS.reduce((sum, [key]) => sum + numeric(costs[key]), 0);
}

function UnitNumber({ label, value, units, update }: { label: string; value: DataRecord; units: string[]; update: (value: DataRecord) => void }) {
  return <label className="focus-field"><span>{label}</span><div className="focus-unit-input"><input type="number" min="0" inputMode="decimal" value={String(value.value ?? "")} onChange={(event) => update({ ...value, value: event.target.value === "" ? "" : Number(event.target.value) })} /><select value={String(value.unit ?? units[0])} onChange={(event) => update({ ...value, unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></div>{value.unit === "Other - Specify" && <input placeholder="Specify unit" value={String(value.otherUnit ?? "")} onChange={(event) => update({ ...value, otherUnit: event.target.value })} />}</label>;
}

function SelectField({ label, value, options, update }: { label: string; value: unknown; options: string[]; update: (value: string) => void }) {
  return <label className="focus-field"><span>{label}</span><select value={String(value ?? "")} onChange={(event) => update(event.target.value)}><option value="">Select an option</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function NumberField({ label, value, update, suffix }: { label: string; value: unknown; update: (value: number | string) => void; suffix?: string }) {
  return <label className="focus-field"><span>{label}</span><div className="focus-unit-input"><input type="number" min="0" inputMode="decimal" value={String(value ?? "")} onChange={(event) => update(event.target.value === "" ? "" : Number(event.target.value))} />{suffix && <i>{suffix}</i>}</div></label>;
}

function MultiChoice({ label, value, options, update }: { label: string; value: unknown; options: string[]; update: (value: string[]) => void }) {
  const selected = Array.isArray(value) ? value as string[] : [];
  const toggle = (option: string) => {
    if (option === "None" || option === "No major constraint") return update(selected.includes(option) ? [] : [option]);
    const withoutExclusive = selected.filter((item) => item !== "None" && item !== "No major constraint");
    update(withoutExclusive.includes(option) ? withoutExclusive.filter((item) => item !== option) : [...withoutExclusive, option]);
  };
  return <fieldset className="focus-field focus-choices"><legend>{label}</legend><div>{options.map((option) => <label className={selected.includes(option) ? "selected" : ""} key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} /><span>{option}</span></label>)}</div></fieldset>;
}

function VarietyFields({ crop, record, update, masterData, multiple }: { crop: CropMasterRecord; record: DataRecord; update: (value: DataRecord) => void; masterData: AdminMasterData; multiple?: boolean }) {
  const approved = masterData.varieties.filter((item) => item.cropId === crop.id && item.active && item.approved).map((item) => item.name);
  const options = [...approved, "Local / Desi", "Other - Specify", "Don't Know"];
  const selected = Array.isArray(record.varieties) ? record.varieties as string[] : [];
  return <>
    {multiple ? <MultiChoice label={`Variety or varieties of ${crop.name}`} value={selected} options={options} update={(varieties) => update({ ...record, varieties })} /> : <SelectField label={`Variety of ${crop.name}`} value={selected[0] ?? ""} options={options} update={(item) => update({ ...record, varieties: item ? [item] : [] })} />}
    {selected.includes("Other - Specify") && <label className="focus-field"><span>Other variety (flagged for Admin review)</span><input value={String(record.otherVariety ?? "")} onChange={(event) => update({ ...record, otherVariety: event.target.value, varietyReviewStatus: "Pending Admin Review" })} /></label>}
    <SelectField label="Variety type" value={record.varietyType} options={VARIETY_TYPES} update={(varietyType) => update({ ...record, varietyType })} />
  </>;
}

function CostFields({ record, update, periodLabel }: { record: DataRecord; update: (value: DataRecord) => void; periodLabel: string }) {
  const costs = (record.costs && typeof record.costs === "object" ? record.costs : {}) as DataRecord;
  const setCost = (key: string, value: number | string) => update({ ...record, costs: { ...costs, [key]: value } });
  return <section className="focus-subsection"><h5>3H. Cost of cultivation — {periodLabel}</h5><div className="focus-grid">{COST_FIELDS.map(([key, label]) => <NumberField key={key} label={`${label} cost`} value={costs[key]} suffix="INR" update={(value) => setCost(key, value)} />)}<NumberField label="Family labour" value={record.familyLabourPersonDays} suffix="person-days" update={(familyLabourPersonDays) => update({ ...record, familyLabourPersonDays })} />{numeric(costs.other) > 0 && <label className="focus-field"><span>Other cost description</span><input value={String(record.otherCostDescription ?? "")} onChange={(event) => update({ ...record, otherCostDescription: event.target.value })} /></label>}</div><div className="focus-calculation"><span>Total cost of cultivation</span><strong>INR {totalCost(costs).toLocaleString("en-IN")}</strong><small>Calculated automatically from component costs</small></div></section>;
}

function PracticeAndConstraintFields({ cropName, record, update, periodLabel }: { cropName: string; record: DataRecord; update: (value: DataRecord) => void; periodLabel: string }) {
  const practices = Array.isArray(record.practices) ? record.practices as string[] : [];
  const constraints = Array.isArray(record.constraints) ? record.constraints as string[] : [];
  return <>
    <section className="focus-subsection"><h5>3G. Production practices — {periodLabel}</h5><MultiChoice label={`Practices used for ${cropName}`} value={practices} options={PRACTICES} update={(next) => update({ ...record, practices: next })} />{practices.includes("Other - Specify") && <label className="focus-field"><span>Other practice</span><input value={String(record.otherPractice ?? "")} onChange={(event) => update({ ...record, otherPractice: event.target.value })} /></label>}</section>
    <section className="focus-subsection"><h5>3I. Production constraints — {periodLabel}</h5><MultiChoice label={`Main constraints affecting ${cropName}`} value={constraints} options={CONSTRAINTS} update={(next) => update({ ...record, constraints: next })} />{constraints.includes("Other - Specify") && <label className="focus-field"><span>Other constraint</span><input value={String(record.otherConstraint ?? "")} onChange={(event) => update({ ...record, otherConstraint: event.target.value })} /></label>}</section>
  </>;
}

function CycleCard({ crop, cycle, index, update, masterData }: { crop: CropMasterRecord; cycle: DataRecord; index: number; update: (value: DataRecord) => void; masterData: AdminMasterData }) {
  const planted = (cycle.areaPlanted && typeof cycle.areaPlanted === "object" ? cycle.areaPlanted : { value: "", unit: "Nali" }) as DataRecord;
  const harvested = (cycle.areaHarvested && typeof cycle.areaHarvested === "object" ? cycle.areaHarvested : { value: "", unit: "Nali" }) as DataRecord;
  const production = (cycle.production && typeof cycle.production === "object" ? cycle.production : { value: "", unit: "kg" }) as DataRecord;
  const comparableWarning = planted.unit === harvested.unit && numeric(harvested.value) > numeric(planted.value) && numeric(planted.value) > 0;
  return <section className="focus-cycle"><header><div><span>Crop cycle {index + 1}</span><strong>{String(cycle.cropCycleId)}</strong></div><b>{crop.name}</b></header><div className="focus-grid"><SelectField label="Season" value={cycle.season} options={SEASONS} update={(season) => update({ ...cycle, season })} />{cycle.season === "Other - Specify" && <label className="focus-field"><span>Other season</span><input value={String(cycle.otherSeason ?? "")} onChange={(event) => update({ ...cycle, otherSeason: event.target.value })} /></label>}<UnitNumber label="Area planted" value={planted} units={AREA_UNITS} update={(areaPlanted) => update({ ...cycle, areaPlanted })} /><UnitNumber label="Area actually harvested" value={harvested} units={AREA_UNITS} update={(areaHarvested) => update({ ...cycle, areaHarvested })} /><UnitNumber label="Total production" value={production} units={PRODUCTION_UNITS} update={(next) => update({ ...cycle, production: next })} /></div>{comparableWarning && <div className="focus-warning">Data-quality warning: harvested area is greater than planted area. Please verify; the response has not been changed.</div>}<div className="focus-calculation"><span>Calculated productivity</span><strong>{productivity(harvested, production, masterData)}</strong><small>Original area and production values remain stored unchanged.</small></div><section className="focus-subsection"><h5>3F. Detailed production</h5><div className="focus-grid"><VarietyFields crop={crop} record={cycle} update={update} masterData={masterData} /><SelectField label="Main source of planting material" value={cycle.plantingMaterialSource} options={PLANTING_SOURCES} update={(plantingMaterialSource) => update({ ...cycle, plantingMaterialSource })} />{cycle.plantingMaterialSource === "Other - Specify" && <label className="focus-field"><span>Other planting material source</span><input value={String(cycle.otherPlantingMaterialSource ?? "")} onChange={(event) => update({ ...cycle, otherPlantingMaterialSource: event.target.value })} /></label>}</div></section><PracticeAndConstraintFields cropName={crop.name} record={cycle} update={update} periodLabel={`cycle ${index + 1}`} /><CostFields record={cycle} update={update} periodLabel={`cycle ${index + 1}`} /></section>;
}

function OrchardCard({ crop, record, update, masterData }: { crop: CropMasterRecord; record: DataRecord; update: (value: DataRecord) => void; masterData: AdminMasterData }) {
  const orchardArea = (record.orchardArea && typeof record.orchardArea === "object" ? record.orchardArea : { value: "", unit: "Nali" }) as DataRecord;
  const bearingArea = (record.bearingArea && typeof record.bearingArea === "object" ? record.bearingArea : { value: "", unit: "Nali" }) as DataRecord;
  const production = (record.production && typeof record.production === "object" ? record.production : { value: "", unit: "kg" }) as DataRecord;
  const comparableWarning = orchardArea.unit === bearingArea.unit && numeric(bearingArea.value) > numeric(orchardArea.value) && numeric(orchardArea.value) > 0;
  return <><section className="focus-subsection"><h5>3E. Perennial / orchard profile — last 12 months</h5><div className="focus-grid"><UnitNumber label={`Total area under ${crop.name} orchard`} value={orchardArea} units={AREA_UNITS} update={(next) => update({ ...record, orchardArea: next })} /><NumberField label="Approximate orchard age" value={record.orchardAgeYears} suffix="years" update={(orchardAgeYears) => update({ ...record, orchardAgeYears })} /><VarietyFields crop={crop} record={record} update={update} masterData={masterData} multiple /><UnitNumber label="Productive / bearing area" value={bearingArea} units={AREA_UNITS} update={(next) => update({ ...record, bearingArea: next })} /><UnitNumber label="Total annual production" value={production} units={PRODUCTION_UNITS} update={(next) => update({ ...record, production: next })} /><SelectField label="Main source of planting material" value={record.plantingMaterialSource} options={PLANTING_SOURCES} update={(plantingMaterialSource) => update({ ...record, plantingMaterialSource })} /></div>{comparableWarning && <div className="focus-warning">Data-quality warning: bearing area is greater than total orchard area. Please verify; the response has not been changed.</div>}<div className="focus-calculation"><span>Calculated productivity</span><strong>{productivity(bearingArea, production, masterData)}</strong><small>Based on bearing area; original farmer-reported values are preserved.</small></div></section><PracticeAndConstraintFields cropName={crop.name} record={record} update={update} periodLabel="last 12 months" /><CostFields record={record} update={update} periodLabel="annual production / maintenance" /></>;
}

export function FocusCropModules({ matchedCropNames, value, update, masterData, draftId }: FocusCropModulesProps) {
  const matchedCropKey = matchedCropNames.map((name) => name.toLowerCase()).sort().join("|");
  const matchedCrops = useMemo(() => {
    const names = matchedCropKey ? matchedCropKey.split("|") : [];
    return masterData.crops.filter((crop) => crop.active && names.includes(crop.name.toLowerCase()));
  }, [masterData.crops, matchedCropKey]);

  useEffect(() => {
    const next = matchedCrops.map((crop) => ({
      ...(value.find((item) => String(item.cropMasterId) === crop.id) ?? emptyModule(crop, draftId)),
      focusCropId: `${draftId}-FOCUS-${slug(crop.name)}`,
      cropMasterId: crop.id,
      cropName: crop.name,
      cropCategory: crop.category,
      cropType: crop.cropType,
      classificationStatus: crop.status,
    }));
    const signature = (items: DataRecord[]) => JSON.stringify(items.map((item) => [item.focusCropId, item.cropMasterId, item.cropName, item.cropCategory, item.cropType, item.classificationStatus]));
    if (signature(value) !== signature(next)) update(next);
  }, [draftId, matchedCrops, update, value]);

  if (!matchedCrops.length) return <div className="focus-empty"><strong>No matching focus crop found</strong><p>Add the household&apos;s cultivated crops in 3A. Detailed focus-crop questions will open automatically only when a reported crop matches the selected FPO mapping.</p></div>;

  const updateModule = (crop: CropMasterRecord, next: DataRecord) => {
    const exists = value.some((item) => item.cropMasterId === crop.id);
    update(exists ? value.map((item) => item.cropMasterId === crop.id ? next : item) : [...value, next]);
  };

  return <div className="focus-modules">{matchedCrops.map((crop) => {
    const cropModule = value.find((item) => item.cropMasterId === crop.id) ?? emptyModule(crop, draftId);
    const focusCropId = String(cropModule.focusCropId);
    const count = cycleNumber(cropModule);
    const cycles = (Array.isArray(cropModule.cycles) ? cropModule.cycles as DataRecord[] : []);
    const orchard = (cropModule.orchard && typeof cropModule.orchard === "object" ? cropModule.orchard : {}) as DataRecord;
    const setCount = (cycleCount: string, customCycleCount: unknown = cropModule.customCycleCount) => {
      const draft = { ...cropModule, cycleCount, customCycleCount };
      const desired = cycleNumber(draft);
      const nextCycles = Array.from({ length: desired }, (_, index) => cycles[index] ?? emptyCycle(focusCropId, index));
      updateModule(crop, { ...draft, cycles: nextCycles });
    };
    return <article className="focus-module" key={crop.id}><header><div><span>Automatically matched FPO focus crop</span><h4>{crop.name}</h4><small>{focusCropId}</small></div><div><b>{crop.cropType}</b><em>{crop.category}</em></div></header>{crop.status !== "Confirmed" || crop.cropType === "Other" ? <div className="focus-warning">Crop classification is pending Admin confirmation. Detailed annual/orchard routing is paused.</div> : crop.cropType === "Annual / Seasonal" ? <><section className="focus-subsection"><h5>3D. Annual / seasonal crop cycles</h5><SelectField label={`How many ${crop.name} crop cycles were cultivated in the last 12 months?`} value={cropModule.cycleCount} options={["1", "2", "3", "More than 3"]} update={(cycleCount) => setCount(cycleCount)} />{cropModule.cycleCount === "More than 3" && <NumberField label="Specify number of crop cycles" value={cropModule.customCycleCount} update={(customCycleCount) => setCount("More than 3", customCycleCount)} />}</section>{count > 0 && Array.from({ length: count }, (_, index) => cycles[index] ?? emptyCycle(focusCropId, index)).map((cycle, index) => <CycleCard key={String(cycle.cropCycleId)} crop={crop} cycle={cycle} index={index} masterData={masterData} update={(next) => updateModule(crop, { ...cropModule, cycles: Array.from({ length: count }, (_, cycleIndex) => cycleIndex === index ? next : cycles[cycleIndex] ?? emptyCycle(focusCropId, cycleIndex)) })} />)}</> : <OrchardCard crop={crop} record={orchard} masterData={masterData} update={(next) => updateModule(crop, { ...cropModule, orchard: next })} />}</article>;
  })}</div>;
}
