"use strict";

const buyerResults = new Map();
const buyerDrafts = new Map();
let buyerTarget = "";
let buyerJob;
const replacementSuffixes = ["com","net","org","co","io","ai","co.uk","ca","com.au","fr","de","se"];

function generateCandidates(row, splitInput, extraInput) {
  const {domain,label,suffix,type} = row;
  const variants = new Map();
  const compact = label.replace(/-/g,"");
  const core = compact.replace(/\d+$/,"") || compact;
  const parts = splitInput.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const exactSplit = parts.length>1 && parts.join("")===compact;
  const words = [...new Set([
    ...extraInput.toLowerCase().split(/[^a-z0-9]+/).filter(word => /^[a-z][a-z0-9]{1,18}$/.test(word)).slice(0,5),
    ...domainTypes.get(type).words
  ])].slice(0,8);
  const home = suffix==="com" ? suffix : "com";

  function add(name, ending, match, score) {
    if (!name || name.length>63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) return;
    const candidate = name+"."+ending;
    if (candidate===domain || variants.has(candidate)) return;
    variants.set(candidate,{domain:candidate,match,score});
  }

  if (label!==compact) add(compact,suffix,"Without hyphen",100);
  if (core!==compact) add(core,suffix,"Without trailing numbers",98);
  if (exactSplit) {
    add(parts.join("-"),suffix,"Hyphenated name",99);
    add(parts.join("-"),home,"Hyphenated name",97);
    for (let index=1;index<parts.length;index++) {
      add(parts.slice(0,index).join("")+"-"+parts.slice(index).join(""),home,"Hyphenated name",94);
    }
  }
  for (const ending of replacementSuffixes) add(label,ending,"Same name · another extension",96);
  for (const number of ["1","24","360","365","247"]) {
    add(core+number,home,"Number added",77);
    add(core+"-"+number,home,"Number + hyphen",75);
  }
  if (/[^sxz]s$/.test(core)) add(core.slice(0,-1),home,"Singular form",82);
  else if (/[a-z]$/.test(core)) add(core+"s",home,"Plural form",82);
  const relatedSuffixes = {
    construction:["builders","building","contracting"],
    builders:["construction","build"],
    pharmacy:["pharmacies","chemist"],
    center:["centre"],
    centre:["center"],
    services:["service"],
    service:["services"]
  };
  const suffixMatch = Object.keys(relatedSuffixes).find(word => core.endsWith(word));
  if (suffixMatch) {
    const stem = core.slice(0,-suffixMatch.length);
    if (stem) {
      for (const synonym of relatedSuffixes[suffixMatch]) {
        add(stem+synonym,home,"Related name",83);
        add(stem+"-"+synonym,home,"Related name + hyphen",80);
      }
    }
  }
  for (const word of words) {
    if (core.endsWith(word) || core.startsWith(word)) continue;
    add(core+word,home,"Trailing keyword",89);
    add(word+core,home,"Leading keyword",85);
    add(core+"-"+word,home,"Keyword + hyphen",86);
    add(core+word,suffix,"Trailing keyword",87);
  }
  add("get"+core,home,"Leading keyword",81);
  add("the"+core,home,"Leading keyword",80);
  add(core+"online",home,"Trailing keyword",80);
  return [...variants.values()].slice(0,52).sort((a,b) => b.score-a.score);
}

function guessNameWords(row) {
  const fromInput = nameHints.get(row.domain);
  if (fromInput) return fromInput.replace(/([a-z0-9])([A-Z])/g,"$1 $2");
  if (row.label.includes("-")) return row.label.replace(/-/g," ");
  const service = row.label.match(serviceWords)?.[0];
  if (service && service.length<row.label.length) {
    return row.label.slice(0,-service.length)+" "+service;
  }
  return row.label;
}

async function askDns(name,type,signal) {
  const url = new URL("https://dns.google/resolve");
  url.searchParams.set("name",name);
  url.searchParams.set("type",type);
  const response = await fetch(url,{
    signal:AbortSignal.any([signal,AbortSignal.timeout(4200)]),
    credentials:"omit",
    referrerPolicy:"no-referrer"
  });
  if (!response.ok) throw new Error("DNS service unavailable");
  const data = await response.json();
  if (data.Status===3) return "absent";
  if (data.Status!==0) throw new Error("DNS lookup failed");
  const code = type==="A"?1:28;
  return data.Answer?.some(record => record.type===code) ? "found" : "empty";
}

async function checkCandidate(candidate,signal) {
  try {
    const root = await askDns(candidate.domain,"A",signal);
    if (root==="absent") return "absent";
    if (root==="found") return "address";
    if (await askDns(candidate.domain,"AAAA",signal)==="found") return "address";
    if (await askDns("www."+candidate.domain,"A",signal)==="found" ||
        await askDns("www."+candidate.domain,"AAAA",signal)==="found") return "www";
    return "absent";
  } catch {
    return "unknown";
  }
}

function externalLink(label,url) {
  const link = element("a",label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function webSearchUrl(phrase) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q",phrase);
  return url.href;
}

function renderBuyers(row) {
  const output = $("buyer-results");
  const result = buyerResults.get(row.domain);
  const onlyDns = $("buyer-confirmed").checked;
  $("buyer-run").disabled = row.subdomain || Boolean(result?.running);
  $("buyer-follow").hidden = row.subdomain;
  $("buyer-results-wrap").hidden = !result;
  output.replaceChildren();
  if (row.subdomain) {
    $("buyer-status").textContent = "Choose a registrable domain to generate prospects.";
    return;
  }
  if (!result) {
    $("buyer-status").textContent = "Generate name variants and check which ones have address records.";
    return;
  }

  const matches = result.rows.filter(item => item.status==="address" || item.status==="www").length;
  const unknown = result.rows.filter(item => item.status==="unknown").length;
  const count = result.rows.filter(item => item.status!=="pending").length;
  $("buyer-status").textContent = result.running ?
    "Checking "+count+" of "+result.rows.length+" names. "+matches+" with DNS so far." :
    (result.cancelled ? "Search stopped. " : "")+
    matches+" with web-address DNS out of "+count+" checked."+(unknown?" "+unknown+" could not be checked.":"");
  const rows = result.rows.filter(item => !onlyDns || ["address","www"].includes(item.status))
    .sort((a,b) => Number(["address","www"].includes(b.status))-Number(["address","www"].includes(a.status)) || b.score-a.score);
  const labels = {address:"Address found",www:"www address found",absent:"No address found",unknown:"Check unavailable",pending:"Not checked"};
  for (const candidate of rows) {
    const tr = document.createElement("tr");
    const site = document.createElement("td");
    const found = ["address","www"].includes(candidate.status);
    if (found) {
      const host = candidate.status==="www" ? "www."+candidate.domain : candidate.domain;
      site.append(externalLink(candidate.domain,"https://"+host+"/"));
    } else site.textContent = candidate.domain;
    const status = element("td",labels[candidate.status],found?"dns-found":"evidence-cell");
    const search = document.createElement("td");
    search.append(externalLink("Search web",webSearchUrl('"'+candidate.domain+'"')));
    tr.append(site,element("td",candidate.match),status,search);
    output.append(tr);
  }
  $("buyer-empty").hidden = rows.length>0;
  $("buyer-empty").textContent = result.running ? "Waiting for the first address match." :
    "No address matches. Turn off the DNS filter to review all variants or use the business-name search.";
}

function showBuyerPanel(row) {
  if (buyerTarget!==row.domain) {
    if (buyerTarget) buyerDrafts.set(buyerTarget,{words:$("buyer-words").value,extras:$("buyer-extras").value});
    buyerTarget = row.domain;
    const draft = buyerDrafts.get(row.domain);
    $("buyer-words").value = draft?.words ?? guessNameWords(row);
    $("buyer-extras").value = draft?.extras ?? "";
  }
  const phrase = $("buyer-words").value.trim() || row.label;
  $("buyer-follow").href = webSearchUrl('"'+phrase.replace(/"/g,"")+'" (company OR website) -domain -domains -forsale');
  renderBuyers(row);
}

$("buyer-form").addEventListener("submit",async event => {
  event.preventDefault();
  const row = portfolio.find(domain => domain.domain===selected);
  if (!row || row.subdomain) return;
  const words = $("buyer-words").value;
  const extras = $("buyer-extras").value;
  buyerDrafts.set(row.domain,{words,extras});
  buyerJob?.abort();
  const job = new AbortController();
  buyerJob = job;
  const rows = generateCandidates(row,words,extras).map(item => ({...item,status:"pending"}));
  const result = {rows,running:true,cancelled:false};
  buyerResults.set(row.domain,result);
  showBuyerPanel(row);
  let next = 0;
  async function worker() {
    while (!job.signal.aborted && next<rows.length) {
      const candidate = rows[next++];
      const status = await checkCandidate(candidate,job.signal);
      if (job.signal.aborted) return;
      candidate.status = status;
      if (selected===row.domain && buyerResults.get(row.domain)===result && (next%3===0 || status==="address" || status==="www")) {
        renderBuyers(row);
      }
    }
  }
  await Promise.all(Array.from({length:6},worker));
  result.running = false;
  result.cancelled = job.signal.aborted;
  if (selected===row.domain && buyerResults.get(row.domain)===result) renderBuyers(row);
});
$("buyer-confirmed").addEventListener("change",() => {
  const row = portfolio.find(domain => domain.domain===selected);
  if (row) renderBuyers(row);
});
$("buyer-words").addEventListener("input",() => {
  const row = portfolio.find(domain => domain.domain===selected);
  if (row) showBuyerPanel(row);
});

$("demo").click();
