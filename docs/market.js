"use strict";

// A small, dated reference sample. Scores reflect relevance to the target family,
// not the source's publication rank or the probability of selling a target name.
const marketReferences = [
  ["impactbuilding.com",10000,"2026-09-26","DomainMarket · DNScroll","https://www.dnscroll.com/fr/impactbuilding.com/","construction","retail",.55],
  ["proheating.com",2075,"2026-11-09","GoDaddy Auction · CatchSEO","https://catchseo.com/reports/domain-auction-report-2026-w46","construction","auction",.60],
  ["timberkits.com",3200,"2026-11-20","DropCatch · DomainGang","https://domaingang.com/domain-news/dropcatch-auctions-select-domain-results-november-20-2026-timberkits-com-3200/","construction","auction",.45],
  ["harborpharmacy.com",325,"2026-10-28","DropCatch · DomainGang","https://domaingang.com/domain-news/dropcatch-auctions-select-domain-results-october-28-2026-orbinite-com-sold-for-37000/","pharmacy","auction",.85],
  ["totalrx.com",75000,"2026-06-04","Sedo · Domain.News","https://domain.news/totalrx-com-sold-for-75000-a-premium-domain-name-precisely-targeting-the-big-health-e-commerce-sector/","pharmacy","context",.20],
  ["veterinaryclinic.com",11695,"2011-10-12","AfternicDLS · DNJournal","https://www.dnjournal.com/archive/domainsales/2011/20111012.htm","vet","context",.35],
  ["vetclinic.com",5099,"2010-09-30","NameJet · DNJournal","https://dnjournal.com/archive/domainsales/2010/20100930.htm","vet","context",.30],
  ["cattoys.com",38000,"2025-11-11","Atom · Domain.News","https://domain.news/cattoys-com-sold-for-38000-via-atom-com/","vet","context",.15],
  ["superagent.si",10000,"2026-11-05","Private sale · NameBio via NamesF","https://namesf.com/sale/superagent.si.html","si-agent","retail",.90],
  ["supercharge.si",1500,"2026-10-18","Atom · Worthly","https://worthly.si/superagent","si-agent","auction",.42],
  ["supercharged.si",1000,"2026-10-28","Atom · Worthly","https://worthly.si/superagent","si-agent","auction",.42],
  ["superfuture.si",250,"2026-10-14","Atom · Worthly","https://worthly.si/superagent","si-agent","context",.25],
  ["chiefsi.com",3000,"2026-11-11","Private sale · NameBio via NamesF","https://namesf.com/sale/chiefsi.com.html","si-brand","retail",.75],
  ["buildlab.ai",9950,"2026-10-27","Spaceship · DNScroll","https://www.dnscroll.com/buildlab.ai/","tech-ai","context",.35]
].map(([domain,price,date,source,url,family,channel,relevance])=>({domain,price,date,source,url,family,channel,relevance}));

function salesFamily(label,suffix,type) {
  if (suffix==="com" && /(?:construction|contracting|builders|building|renovation|roofing|heating|plumbing|electric|remodeling)$/.test(label)) return "construction";
  if (suffix==="com" && /pharmac(?:y|ies)$/.test(label)) return "pharmacy";
  if (suffix==="com" && /(?:vet(?:erinary)?|cat(?:s|care|clinic|health)|pet(?:s|care|clinic|health))$/.test(label)) return "vet";
  if (suffix==="si" && /agents?$/.test(label)) return "si-agent";
  if (suffix==="com" && /[a-z]{3,}si$/.test(label) && (type==="tech" || findNameMeaning(label,type).terms.includes("si"))) return "si-brand";
  if (suffix==="ai" && type==="tech") return "tech-ai";
  return null;
}

function relatedSales(domain,label,suffix,type) {
  const family = salesFamily(label,suffix,type);
  if (!family) return [];
  return marketReferences.filter(sale => sale.family===family && sale.domain!==domain)
    .map(sale => {
      const gap = Math.abs(domainParts(sale.domain).label.length-label.length);
      return {...sale,relevance:sale.relevance*(gap<=3?1:gap<=6?.8:.55)};
    });
}
