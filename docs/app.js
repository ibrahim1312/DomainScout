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

const marketTerms = new Set((
  "accounting agency agent agents analytics app architecture art assistant auto autos bakery bank beauty bike bikes " +
  "booking broker brokers build builder builders building cafe camping car cars care cargo catering cats chatbot " +
  "church clean cleaning clinic clinics cloud coach code coding coffee commerce community company computer construction " +
  "consulting contracting copilot cybersecurity data daycare delivery dental dentist design development digital doctor " +
  "doctors dog dogs ecommerce education electrician electric energy engineering estate events finance fitness flights " +
  "flowers food garden gardening gear glass gogreen grocery group health healthcare heating help hiring home homes " +
  "hosting hotel hotels house houses immigration insurance investing investments job jobs kitchen kitchens lab labs " +
  "land law lawyer lawyers ledger legal loans locksmith logistics mail market marketplace marketing media medicine " +
  "mobile mortgage movers music network news nursing office online parts pets pet pharmacy photo photography pizza " +
  "plumbing plumber podcast print printing property publishing realestate recruitment renovation rentals repair repairs " +
  "restaurant restaurants roofing sales salon school secure security senior services shipping shop shopping skin " +
  "software solar sponsor sports stock storage studio support tailor tailors tax taxi teaching team technology tech " +
  "therapy tools trade training translation travel truck trucks tutor vacation veterinary video visa warehouse " +
  "web wedding wellness windows work yoga voiture maison immobilier agence sante nettoyage voyage emploi " +
  "travaux entreprenad bygg elbil bil jobb vård frisör si ai gpt api"
).split(" "));
const commonTerms = new Set((
  "access active alpha animal atlas beach berry best better bird black bloom blue bold bright brook central centre " +
  "cedar city clear coast connect core country creative daily direct easy earth east express fair fallow fast first " +
  "flow forest fresh future global gold good green grove guide high hill horizon hub international island key kids " +
  "king lake landing leaf life light link lion local main map match mind modern mountain move nation natural " +
  "nature next north nova oak ocean open orange organic park path peak pine place planet point prime quick radio " +
  "rapid red remote resource ridge river road rock rose route royal safe search silver simple smart social south " +
  "spark spring star stone summit sun system systemic test time top trail tree trust united urban valley value " +
  "venture village virtual vista voice signal worker networker water wave west white wild win winter wise world zen zed"
).split(" "));
const places = new Set((
  "amsterdam berlin boston brussels california casablanca chicago dakhla dubai dublin france germany glasgow " +
  "gothenburg hobart istanbul london losangeles madrid malmo marrakech melbourne miami milan montreal morocco " +
  "newyork oslo ouarzazate paris rabat rochester rome sanfrancisco seattle stockholm sweden sydney tangier toronto"
).split(" "));
const wordConnectors = new Set(["and","for","of","the","with","to","de","du","des","la","le"]);
const shortSuffixes = new Set(["ai","si","gpt","api"]);

function termKind(term) {
  if (places.has(term)) return "place";
  if (marketTerms.has(term)) return "market";
  if (commonTerms.has(term)) return "word";
  return wordConnectors.has(term) ? "connector" : null;
}

function splitMeaningfulWords(segment) {
  const best = Array(segment.length+1).fill(null);
  best[0] = [];
  for (let start=0;start<segment.length;start++) {
    if (!best[start]) continue;
    for (let end=start+2;end<=segment.length;end++) {
      const term = segment.slice(start,end);
      const kind = termKind(term);
      if (!kind) continue;
      if (shortSuffixes.has(term) && start>0 && end!==segment.length) continue;
      const sequence = [...best[start],{term,kind}];
      if (!best[end] || sequence.length<best[end].length) best[end] = sequence;
    }
  }
  const match = best.at(-1);
  if (!match || match[0].kind==="connector" || match.at(-1).kind==="connector") return [];
  return match;
}

function findNameMeaning(label,type) {
  const segments = label.split(/[-0-9]+/).filter(Boolean);
  const terms = segments.flatMap(splitMeaningfulWords);
  const substantive = terms.filter(word => word.kind!=="connector");
  const longWord = substantive.some(word => word.term.length>=3 && !shortSuffixes.has(word.term));
  const hasMarketTerm = substantive.some(word => word.kind==="market" || word.kind==="place");
  let uplift = 1;
  if (longWord && hasMarketTerm) uplift = substantive.length>1 ? 1.65 : 1.40;
  else if (longWord) uplift = substantive.length>1 ? 1.38 : 1.24;

  // Make search terms available even when the first part is a brand or personal name.
  const service = serviceWords.exec(label)?.[0];
  if (uplift===1 && service && label.length>service.length) {
    substantive.push({term:service,kind:"market"});
    uplift = type==="personal" ? 1.15 : 1.20;
  }
  if (type==="personal") uplift = Math.min(uplift,1.24);
  return {terms:substantive.map(word=>word.term),uplift};
}

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
  const meaning = findNameMeaning(label,type);
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
  const descriptiveCom = suffix==="com" && formatFactor===1 && n<=18 &&
    serviceWords.test(label) && (type==="business" || type==="local");
  // Asking-price assumptions for compact, descriptive business names on .com.
  const businessComBase = n<=12 ? 500 : 400;
  const extensionBaseline = descriptiveCom ? businessComBase :
    (extensionBases.get(extension) ?? 38)*lengthFactor*formatFactor;
  const semanticFactor = descriptiveCom ? 1 : meaning.uplift;
  const family = salesFamily(label,suffix,type);
  const readablePremium = !descriptiveCom && formatFactor===1 && n<=21 && meaning.uplift>1 && type!=="personal";
  // Higher retail asking scenarios for meaningful names. Exact sales remain separate evidence.
  const retailFactor = readablePremium ? suffix==="com" ? 1.7 : suffix==="si" && family==="si-agent" ? 4.8 : 1.25 : 1;
  const baseline = extensionBaseline*domainTypes.get(type).factor*semanticFactor*retailFactor;
  const qualified = subdomain ? [] : sales.filter(sale => {
    const comparable = domainParts(sale.domain);
    return sale.domain!==domain && !comparable.subdomain && comparable.suffix===suffix &&
      Math.abs(comparable.label.length-n)<=Math.min(4,Math.max(1,Math.ceil(n*.28))) &&
      /[0-9-]/.test(comparable.label)===/[0-9-]/.test(label);
  });
  const suppliedDomains = new Set(qualified.map(sale=>sale.domain));
  const references = subdomain ? [] : relatedSales(domain,label,suffix,type)
    .filter(sale=>!suppliedDomains.has(sale.domain));
  const autoRetail = references.filter(sale=>sale.channel==="retail");
  const auctionPrices = references.filter(sale=>sale.channel==="auction").map(sale=>sale.price).sort((a,b)=>a-b);
  const prices = qualified.map(sale => sale.price).sort((a,b) => a-b);
  function median(values) {
    if (!values.length) return null;
    return (values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2;
  }
  const observed = median(prices);
  const auctionMedian = median(auctionPrices);
  const suppliedWeight = Math.min(.68,prices.length*.14);
  const researchWeight = (1-suppliedWeight)*Math.min(.36,autoRetail.reduce((sum,sale)=>sum+sale.relevance*.34,0));
  const auctionWeight = auctionMedian===null ? 0 : Math.min(.35,auctionPrices.length*.14);
  // Prevent one reported sale from taking over the estimate. Auction prices inform the quick scenario.
  const boundedRatio = (price,cap) => Math.min(cap,Math.max(.2,price/baseline));
  const userAdjustment = observed===null ? 1 : boundedRatio(observed,20)**suppliedWeight;
  const retailCenter = median(autoRetail.map(sale=>sale.price).sort((a,b)=>a-b));
  const researchAdjustment = retailCenter===null ? 1 : boundedRatio(retailCenter,16)**researchWeight;
  const auctionSignal = auctionMedian===null || retailCenter!==null ? 1 :
    boundedRatio(auctionMedian,8)**Math.min(.16,auctionWeight*.6);
  const marketEstimate = subdomain ? null : baseline*userAdjustment*researchAdjustment*auctionSignal;
  const negotiationMargin = !subdomain && (meaning.uplift>1 || descriptiveCom) ? .10 : 0;
  const estimate = marketEstimate===null ? null : marketEstimate*(1+negotiationMargin);
  const marketSignals = prices.length+autoRetail.length+auctionPrices.length;
  const spread = prices.length>=5 ? .33 : prices.length>=2 ? .45 : marketSignals ? .50 : descriptiveCom ? .375 : .58;
  const quickBasis = marketEstimate*(descriptiveCom?.625:.38);
  const auctionQuick = auctionMedian===null ? quickBasis :
    Math.max(quickBasis*.35,Math.min(quickBasis*4,auctionMedian))**auctionWeight*quickBasis**(1-auctionWeight);
  const quick = Math.min(marketEstimate*(1-spread),auctionQuick);
  const weight = suppliedWeight+researchWeight+(auctionSignal===1?0:Math.min(.16,auctionWeight*.6));
  const round = (value,step=5) => Math.max(step,Math.round(value/step)*step);
  return {domain,label,suffix,subdomain,type,meaning,semanticFactor,retailFactor,negotiationMargin,descriptiveCom,breakdown,quality,qualified,references,observed,auctionMedian,weight,
    low:estimate===null?null:round(estimate*(1-spread)),
    estimate:estimate===null?null:round(estimate),
    high:estimate===null?null:round(estimate*(1+spread)),
    quick:estimate===null?null:round(quick),
    evidence:subdomain?"Subdomain":prices.length>=5?"5+ supplied sales":prices.length?"Supplied sales":
      marketSignals?"Limited market sample":references.length?"Historical context":"Name-based estimate"};
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
  $("priced").textContent = portfolio.filter(item => item.qualified.length || item.references.length).length;
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
  const recognized = row.meaning.terms.join(" · ");
  const meaningLabel = row.descriptiveCom ? "Pricing already reflects the descriptive business name" :
    row.semanticFactor>1 ? "+"+Math.round((row.semanticFactor-1)*100)+"% to starting price" :
    "No words recognized for a pricing adjustment";
  $("name-meaning").textContent = row.subdomain ? "" : recognized ? recognized+" · "+meaningLabel : meaningLabel;
  $("retail-adjustment").textContent = row.retailFactor>1 && !row.subdomain ?
    "Additional asking-price adjustment: ×"+row.retailFactor.toFixed(2).replace(/0$/,"") : "";
  $("negotiation-margin").textContent = row.negotiationMargin ?
    "+"+Math.round(100*row.negotiationMargin)+"% asking-price room for negotiation" : "";
  $("quick").textContent = usd(row.quick);
  $("price-note").textContent = row.subdomain ?
    "Resale estimates are for registrable domain names." :
    row.qualified.length ? "Indicative asking price using the comparables you supplied and any relevant published sales." :
    row.references.some(sale=>sale.channel!=="context") ? "Indicative asking price calibrated against a small sample of reported sales." :
    "Name-based asking scenario. Closely matching recent sales may be unavailable.";
  showBuyerPanel(row);
  $("estimate").textContent = usd(row.estimate);
  $("low").textContent = usd(row.low);
  $("high").textContent = usd(row.high);
  $("range").hidden = row.estimate===null;
  if (row.estimate!==null) {
    $("range").style.setProperty("--position",100*(row.estimate-row.low)/Math.max(1,row.high-row.low)+"%");
  }
  $("comp-count").textContent = row.qualified.length+row.references.length;
  $("comp-median").textContent = usd(row.observed);
  $("auction-median").textContent = usd(row.auctionMedian);
  $("published-sales").replaceChildren(...row.references.map(sale=>{
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = sale.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = sale.domain;
    const channel = sale.channel==="context" ? "Context only" : sale.channel==="auction" ? "Auction" : "Reported retail";
    item.append(link,element("span"," "+usd(sale.price)+" · "+channel+" · "+sale.date+" · "+sale.source));
    return item;
  }));
  $("published-records").hidden = !row.references.length;
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
    "domain,type,quality_score,retail_low_usd,retail_estimate_usd,retail_high_usd,quick_sale_scenario_usd,evidence,supplied_comparable_count,supplied_median_usd,published_reference_count,published_auction_median_usd",
    ...portfolio.map(row => [row.domain,domainTypes.get(row.type).name,row.quality,row.low,row.estimate,row.high,row.quick,row.evidence,
      row.qualified.length,row.observed ?? "",row.references.length,row.auctionMedian ?? ""].join(","))
  ];
  const url = URL.createObjectURL(new Blob([rows.join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "domainscout-portfolio.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
