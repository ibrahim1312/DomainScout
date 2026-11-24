"use strict";

const $ = id => document.getElementById(id);
const currency = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0});
const usd = amount => amount===null ? "—" : currency.format(amount);
const extensionPoints = new Map([["com",25],["org",17],["net",16],["io",16],["ai",16]]);
const extensionBases = new Map([["com",180],["org",85],["net",65],["io",140],["ai",160],
  ["co",75],["uk",90],["de",90],["fr",75],["ca",80],["au",85],["si",45]]);
const domainTypes = new Map([
  ["brand", {name:"Brandable", factor:.85, words:["agency","group","studio"]}],
  ["business", {name:"Business / service", factor:1, words:["group","services","solutions"]}],
  ["local", {name:"Local / geographic", factor:.85, words:["group","services","local"]}],
  ["tech", {name:"Tech / AI", factor:.95, words:["ai","tech","labs","app"]}],
  ["personal", {name:"Personal name", factor:.55, words:["studio","official","online"]}],
  ["descriptive", {name:"Keyword / descriptive", factor:.85, words:["online","shop","hub"]}],
  ["short", {name:"Short name / acronym", factor:1.15, words:["group","labs","co"]}],
  ["mixed", {name:"Hyphenated / numeric", factor:.63, words:["group","online","services"]}]
]);
const selectedTypes = new Map();
const nameHints = new Map();
const serviceWords = /(?:construction|renovation|builders|repair|pharmacy|plumbing|roofing|dental|clinic|law|logistics|cleaning|realestate|insurance|accounting|electric|restaurant|tailor|studio|services|consulting|agency|shop|hotel)$/;
const geographicWords = /^(?:rochester|hobart|newyork|sanfrancisco|london|paris|dublin|stockholm|casablanca|dubai|miami|chicago|boston|sweden|morocco)|(?:newyork|sanfrancisco|london|paris|stockholm|dubai|miami|chicago|boston)$/;
const shortCountrySuffix = /^(?:co|com|org|net|ac|gov)\.[a-z]{2}$/;

function domainParts(domain) {
  const labels = domain.split(".");
  const tail = labels.slice(-2).join(".");
  const suffixSize = labels.length >= 3 && shortCountrySuffix.test(tail) ? 2 : 1;
  const suffix = labels.slice(-suffixSize).join(".");
  return {label:labels.at(-suffixSize-1), suffix, subdomain:labels.length > suffixSize+1};
}

function domainType(label, suffix) {
  if (/[0-9-]/.test(label)) return "mixed";
  if (label.length <= 4) return "short";
  if (geographicWords.test(label) && serviceWords.test(label)) return "local";
  if (/^(?:doctor|dr|lawyer|attorney|coach)(?:jessica|james|john|sarah|maria|david|anna|emma)$/.test(label)) return "personal";
  if (/^(?:ai|io|dev|app)$/.test(suffix) || /(?:ai|software|tech|robotics|cloud|data|labs)$/.test(label)) return "tech";
  if (serviceWords.test(label)) return "business";
  if (/(?:for|with)(?:cats|dogs|kids|pets|homes|cars|business)$/.test(label)) return "descriptive";
  return "brand";
}
const sample = ["CedarTrail.com","StudioLedger.io","BrightSignal.ai"];
const evidenceByDomain = new Map();
let portfolio = [];
let selected = "";

function normalizeDomain(raw) {
  const domain = raw.trim().toLowerCase().replace(/\.$/,"");
  const parts = domain.split(".");
  return domain.length <= 253 && parts.length >= 2 &&
    /^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/.test(parts.at(-1)) &&
    parts.every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) ? domain : null;
}

function evaluate(domain, sales) {
  const {label,suffix,subdomain} = domainParts(domain);
  const autoType = domainType(label,suffix);
  const type = selectedTypes.get(domain) ?? autoType;
  const n = label.length;
  const extension = suffix.split(".").at(-1);
  const lengthPoints = n<=4 ? 30 : n<=8 ? 26 : n<=12 ? 22 : n<=18 ? 15 : n<=24 ? 8 : 2;
  const breakdown = [
    ["Name length", lengthPoints, 30],
    ["Extension", extensionPoints.get(extension) ?? 10, 25],
    ["No hyphens", label.includes("-")?0:15, 15],
    ["No digits", /\d/.test(label)?0:15, 15],
    ["Letters only", /^[a-z]+$/.test(label)?15:0, 15]
  ];
  const quality = breakdown.reduce((sum,[,score]) => sum+score,0);
  const lengthFactor = n<=4 ? 1.65 : n<=8 ? 1.2 : n<=12 ? 1 : n<=18 ? .68 : n<=24 ? .42 : .25;
  const formatFactor = (label.includes("-") ? .68 : 1) * (/\d/.test(label) ? .58 : 1);
  // Conservative asking-price assumptions. A real sale or quick exit is not guaranteed.
  const baseline = (extensionBases.get(extension) ?? 38)*lengthFactor*formatFactor*domainTypes.get(type).factor;
  const qualified = subdomain ? [] : sales.filter(sale => {
    const comparable = domainParts(sale.domain);
    return sale.domain!==domain && !comparable.subdomain && comparable.suffix===suffix &&
      Math.abs(comparable.label.length-n)<=Math.min(4,Math.max(1,Math.ceil(n*.28))) &&
      /[0-9-]/.test(comparable.label)===/[0-9-]/.test(label);
  });
  const prices = qualified.map(sale => sale.price).sort((a,b) => a-b);
  const quantile = p => {
    const index = (prices.length-1)*p;
    const lower = Math.floor(index);
    return prices[lower]+(prices[Math.ceil(index)]-prices[lower])*(index-lower);
  };
  const observed = prices.length ? quantile(.5) : null;
  const weight = Math.min(.68,prices.length*.12);
  const lowerEvidence = (observed ?? baseline)*(prices.length>=3?.82:1);
  const anchor = Math.max(baseline/4,Math.min(baseline*12,lowerEvidence));
  const estimate = subdomain ? null : baseline*(anchor/baseline)**weight;
  const spread = prices.length>=5?.33:prices.length>=2?.45:.58;
  const round = (value,step=5) => Math.max(step,Math.round(value/step)*step);
  return {domain,label,suffix,subdomain,type,breakdown,quality,qualified,observed,weight,
    low:estimate===null?null:round(estimate*(1-spread)),
    estimate:estimate===null?null:round(estimate),
    high:estimate===null?null:round(estimate*(1+spread)),
    quick:estimate===null?null:round(estimate*.20),
    evidence:subdomain?"Subdomain":prices.length>=5?"5+ supplied sales":prices.length?"Limited sales":"No sales data"};
}

function parseEvidence(value) {
  const sales = new Map();
  const issues = [];
  value.split(/\r?\n/).forEach((line,index) => {
    if (!line.trim()) return;
    const fields = line.split("|").map(part => part.trim());
    const [raw,priceText,source] = fields;
    const domain = normalizeDomain(raw);
    const price = Number(priceText);
    if (fields.length!==3 || !domain || !/^\d+(?:\.\d{1,2})?$/.test(priceText) || price<=0 || price>100000000 || !source) {
      issues.push("Line "+(index+1)+": use domain | USD price | source.");
    } else if (sales.has(domain)) {
      issues.push("Line "+(index+1)+": duplicate sale for "+domain+".");
    } else {
      sales.set(domain,{domain,price,source});
    }
  });
  return {sales:[...sales.values()],issues};
}

function element(tag,value,className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function renderNet() {
  const row = portfolio.find(item => item.domain===selected);
  if (!row) return;
  const inputs = ["cost","renewal","years","commission"].map($);
  const show = (id,value) => { $(id).textContent = value; };
  if (row.estimate===null || inputs.some(input => !input.value || !input.validity.valid)) {
    ["proceeds","net","break-even"].forEach(id => show(id,"—"));
    return;
  }
  const [cost,renewal,years,commission] = inputs.map(input => Number(input.value));
  const retained = 1-commission/100;
  const proceeds = row.estimate*retained;
  const expenses = cost+renewal*years;
  const net = proceeds-expenses;
  show("proceeds",usd(proceeds));
  show("net",usd(net));
  $("net").classList.toggle("negative",net<0);
  show("break-even",retained>0?usd(Math.ceil(expenses/retained)):"—");
}

function render() {
  const row = portfolio.find(item => item.domain===selected);
  $("count").textContent = portfolio.length;
  $("average").textContent = portfolio.length ?
    (portfolio.reduce((total,item) => total+item.quality,0)/portfolio.length).toFixed(1) : "—";
  $("priced").textContent = portfolio.filter(item => item.qualified.length).length;
  $("export").disabled = !portfolio.length;
  const body = $("results");
  body.replaceChildren();
  for (const item of portfolio) {
    const tr = document.createElement("tr");
    tr.classList.toggle("active",item.domain===selected);
    const cell = document.createElement("td");
    const choose = element("button",item.domain,"domain-button");
    choose.type = "button";
    choose.setAttribute("aria-pressed",String(item.domain===selected));
    choose.addEventListener("click",() => {
      selected = item.domain;
      render();
      body.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    });
    cell.append(choose);
    tr.append(cell,element("td",domainTypes.get(item.type).name),element("td",item.quality+"/100"),
      element("td",item.estimate===null ? "—" : usd(item.low)+"–"+usd(item.high)),
      element("td",item.evidence,"evidence-cell"));
    body.append(tr);
  }
  $("workspace").hidden = !row;
  $("empty").hidden = Boolean(row);
  if (!row) return;
  $("domain-title").textContent = row.domain;
  $("evidence").textContent = row.evidence;
  $("domain-type").value = selectedTypes.get(row.domain) ?? "auto";
  $("type-detected").textContent = row.subdomain ? "Subdomain · no resale estimate" :
    (selectedTypes.has(row.domain) ? "Manual type · " : "Detected · ")+domainTypes.get(row.type).name;
  $("quick").textContent = usd(row.quick);
  $("price-note").textContent = row.subdomain ?
    "Resale estimates are for registrable domain names." :
    row.qualified.length ? "Indicative asking price using the comparables you supplied." :
    "Conservative asking-price scenario based on the name and extension alone.";
  showBuyerPanel(row);
  $("estimate").textContent = usd(row.estimate);
  $("low").textContent = usd(row.low);
  $("high").textContent = usd(row.high);
  $("range").hidden = row.estimate===null;
  if (row.estimate!==null) {
    $("range").style.setProperty("--position",100*(row.estimate-row.low)/Math.max(1,row.high-row.low)+"%");
  }
  $("comp-count").textContent = row.qualified.length;
  $("comp-median").textContent = row.observed===null?"—":usd(row.observed);
  $("weight").textContent = Math.round(row.weight*100)+"%";
  $("score").textContent = row.quality+"/100";
  $("sales").value = evidenceByDomain.get(row.domain)?.input ?? "";
  $("sales-feedback").textContent = evidenceByDomain.get(row.domain)?.feedback ??
    "Use completed sales that match the target’s category and buyer market.";
  $("matched-sales").replaceChildren(...row.qualified.map(sale =>
    element("li",sale.domain+" · "+usd(sale.price)+" · "+sale.source)));
  $("breakdown").replaceChildren(...row.breakdown.map(([label,score,max]) => {
    const line = document.createElement("div");
    line.className = "factor";
    const bar = document.createElement("progress");
    bar.value = score;
    bar.max = max;
    bar.setAttribute("aria-label",label);
    line.append(element("span",label),bar,element("strong",score+"/"+max));
    return line;
  }));
  renderNet();
}

function runAnalysis() {
  const valid = new Set();
  const invalid = new Set();
  for (const raw of $("domains").value.split(/[\s,]+/).filter(Boolean)) {
    const domain = normalizeDomain(raw);
    if (domain) {
      valid.add(domain);
      const original = raw.split(".").find(label => label.toLowerCase()===domainParts(domain).label);
      if (original && /[a-z][A-Z]/.test(original)) nameHints.set(domain,original);
    } else invalid.add(raw);
  }
  portfolio = [...valid].map(domain => evaluate(domain,evidenceByDomain.get(domain)?.sales ?? []))
    .sort((a,b) => b.quality-a.quality || a.domain.localeCompare(b.domain));
  if (!valid.has(selected)) selected = portfolio[0]?.domain ?? "";
  $("analyze-feedback").textContent = invalid.size ?
    "Invalid entries: "+[...invalid].slice(0,6).join(", ")+(invalid.size>6?" and "+(invalid.size-6)+" more.":".") :
    portfolio.length ? "Analyzed "+portfolio.length+(portfolio.length===1?" domain.":" domains.") :
    "Enter at least one domain to analyze.";
  render();
}

for (const [key,type] of domainTypes) {
  const option = element("option",type.name);
  option.value = key;
  $("domain-type").append(option);
}
$("domain-type").addEventListener("change",() => {
  const value = $("domain-type").value;
  if (value==="auto") selectedTypes.delete(selected);
  else selectedTypes.set(selected,value);
  portfolio = portfolio.map(row => row.domain===selected ?
    evaluate(selected,evidenceByDomain.get(selected)?.sales ?? []) : row);
  render();
});
$("analyze").addEventListener("submit",event => {event.preventDefault();runAnalysis();});
$("demo").addEventListener("click",() => {
  $("domains").value = sample.join("\n");
  selected = sample[0].toLowerCase();
  runAnalysis();
});
$("evidence-form").addEventListener("submit",event => {
  event.preventDefault();
  if (!selected) return;
  const input = $("sales").value;
  const {sales,issues} = parseEvidence(input);
  if (issues.length) {
    $("sales-feedback").textContent = issues.slice(0,4).join(" ");
    return;
  }
  const revised = evaluate(selected,sales);
  const excluded = sales.length-revised.qualified.length;
  const feedback = sales.length ?
    revised.qualified.length+" included. "+excluded+" excluded by the suffix, length, or target-name filter." :
    "No comparable sales are applied.";
  evidenceByDomain.set(selected,{input,sales,feedback});
  portfolio = portfolio.map(row => row.domain===selected?revised:row);
  render();
});
["cost","renewal","years","commission"].forEach(id => $(id).addEventListener("input",renderNet));
$("export").addEventListener("click",() => {
  const rows = [
    "domain,type,quality_score,retail_low_usd,retail_estimate_usd,retail_high_usd,quick_sale_scenario_usd,evidence,comparable_count,comparable_median_usd",
    ...portfolio.map(row => [row.domain,domainTypes.get(row.type).name,row.quality,row.low,row.estimate,row.high,row.quick,row.evidence,
      row.qualified.length,row.observed ?? ""].join(","))
  ];
  const url = URL.createObjectURL(new Blob([rows.join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "domainscout-portfolio.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
