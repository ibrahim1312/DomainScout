"use strict";

const $ = id => document.getElementById(id);
const currency = new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0});
const usd = amount => currency.format(amount);
const extensionPoints = new Map([["com",25],["org",17],["net",16],["io",16],["ai",16]]);
const extensionBases = new Map([["com",520],["org",220],["net",180],["io",400],["ai",600]]);
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
  const parts = domain.split(".");
  const label = parts[0];
  const tld = parts.at(-1);
  const n = label.length;
  const breakdown = [
    ["Name length", n<=6?30:n<=10?25:n<=15?18:n<=22?8:2, 30],
    ["Extension", extensionPoints.get(tld) ?? 10, 25],
    ["No hyphens", label.includes("-")?0:15, 15],
    ["No digits", /\d/.test(label)?0:15, 15],
    ["Letters only", /^[a-z]+$/.test(label)?15:0, 15]
  ];
  const quality = breakdown.reduce((sum,[,score]) => sum + score,0);
  // Explicit USD retail assumptions, not coefficients fitted on a sales dataset.
  const heuristic = Math.max(25,(extensionBases.get(tld) ?? 130) * (quality/75)**2.5);
  const qualified = sales.filter(sale => {
    const comparable = sale.domain.split(".");
    return sale.domain !== domain && comparable.slice(1).join(".") === parts.slice(1).join(".") &&
      Math.abs(comparable[0].length - n) <= 5;
  });
  const prices = qualified.map(sale => sale.price).sort((a,b) => a-b);
  const quantile = p => {
    const index = (prices.length-1)*p;
    const lower = Math.floor(index);
    return prices[lower]+(prices[Math.ceil(index)]-prices[lower])*(index-lower);
  };
  const observed = prices.length ? quantile(.5) : null;
  const weight = Math.min(.85,prices.length*.17);
  const estimate = heuristic*(1-weight)+(observed ?? 0)*weight;
  const spread = prices.length>=5?.34:prices.length>=2?.53:.68;
  const low = Math.min(estimate*(1-spread),prices.length>=2?quantile(.25):Infinity);
  const high = Math.max(estimate*(1+spread),prices.length>=2?quantile(.75):0);
  function round(value) {
    const increment = value>=1000?50:10;
    return Math.max(5,Math.round(value/increment)*increment);
  }
  return {domain,breakdown,quality,qualified,observed,weight,low:round(low),estimate:round(estimate),high:round(high),
    evidence:prices.length>=5?"More sales":prices.length?"Limited sales":"Heuristic only"};
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
  if (inputs.some(input => !input.value || !input.validity.valid)) {
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
    tr.append(cell,element("td",item.quality+"/100"),element("td",usd(item.low)+"–"+usd(item.high)),
      element("td",item.evidence,"evidence-cell"));
    body.append(tr);
  }
  $("workspace").hidden = !row;
  $("empty").hidden = Boolean(row);
  if (!row) return;
  $("domain-title").textContent = row.domain;
  $("evidence").textContent = row.evidence;
  $("estimate").textContent = usd(row.estimate);
  $("low").textContent = usd(row.low);
  $("high").textContent = usd(row.high);
  $("range").style.setProperty("--position",100*(row.estimate-row.low)/Math.max(1,row.high-row.low)+"%");
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
    if (domain) valid.add(domain);
    else invalid.add(raw);
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
    "domain,quality_score,retail_low_usd,retail_estimate_usd,retail_high_usd,evidence,comparable_count,comparable_median_usd",
    ...portfolio.map(row => [row.domain,row.quality,row.low,row.estimate,row.high,row.evidence,
      row.qualified.length,row.observed ?? ""].join(","))
  ];
  const url = URL.createObjectURL(new Blob([rows.join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "domainscout-portfolio.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
$("demo").click();
