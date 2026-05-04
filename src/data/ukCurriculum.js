// UK National Curriculum statutory spelling word lists, organised by year group.
// Year 3-4 and Year 5-6 are from the DfE statutory appendix.
// Year 1-2 use the Rose Review high-frequency / common exception word lists.

const WORDS = {
  1: [
    'the','a','do','to','today','of','said','says','are','were','was','is',
    'his','has','I','you','your','they','be','he','she','we','me','no','my',
    'by','all','sure','come','some','here','there','when','what','one','out',
    'like','little','look','have','put','day','made','make','came','home',
    'old','time','back','very','much','door','only','who',
  ],
  2: [
    'door','floor','poor','because','find','kind','mind','behind','child',
    'children','wild','climb','most','only','both','cold','gold','hold','told',
    'every','great','break','pretty','beautiful','after','fast','last','past',
    'father','class','grass','plant','path','bath','hour','move','prove',
    'improve','sure','sugar','eye','could','should','would','whole','any',
    'many','clothes','busy','people','water','again','half','money','everybody',
  ],
  3: [
    'accident','actually','address','appear','arrive','believe','bicycle',
    'breath','breathe','build','busy','calendar','caught','centre','century',
    'certain','circle','complete','consider','continue','decide','describe',
    'different','difficult','disappear','early','earth','enough','exercise',
    'experience','experiment','extreme','famous','favourite','February',
    'forward','fruit','grammar','group','guard','guide','heard','heart',
  ],
  4: [
    'height','history','imagine','increase','important','interest','island',
    'knowledge','learn','length','library','material','medicine','mention',
    'minute','natural','naughty','neighbour','notice','occasion','often',
    'opposite','ordinary','particular','peculiar','perhaps','popular',
    'position','possible','potatoes','pressure','probably','promise','purpose',
    'quarter','question','recent','regular','reign','remember','sentence',
    'separate','special','straight','strange','strength','suppose','surprise',
    'therefore','though','thought','through','various','weight','woman','women',
  ],
  5: [
    'accommodate','accompany','aggressive','amateur','ancient','apparent',
    'appreciate','attached','available','average','awkward','bargain','bruise',
    'category','cemetery','committee','communicate','community','competition',
    'conscience','conscious','controversy','convenience','correspond',
    'criticise','curiosity','definite','desperate','determined','develop',
    'dictionary','disastrous','embarrass','environment','equip','especially',
    'exaggerate','excellent','existence','explanation','familiar','foreign',
  ],
  6: [
    'forty','frequently','government','guarantee','harass','hindrance',
    'identity','immediate','individual','interfere','interrupt','language',
    'leisure','lightning','marvellous','mischievous','muscle','necessary',
    'nuisance','occupy','occur','official','parliament','persuade','physical',
    'prejudice','privilege','profession','programme','pronunciation','queue',
    'recognise','recommend','relevant','restaurant','rhyme','rhythm',
    'sacrifice','secretary','shoulder','signature','sincere','soldier',
    'stomach','sufficient','suggest','symbol','system','temperature',
    'thorough','twelfth','variety','vegetable','vehicle','yacht',
  ],
};

/** Convert age (5-12) to school year (1-6). */
export function ageToYear(age) {
  return Math.max(1, Math.min(6, age - 5));
}

/** Pick `count` random words from the given year (1-6). */
export function getWordsForYear(year, count = 20) {
  const pool = WORDS[Math.max(1, Math.min(6, year))] || WORDS[3];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export const YEAR_LABELS = {
  1: 'Year 1', 2: 'Year 2', 3: 'Year 3',
  4: 'Year 4', 5: 'Year 5', 6: 'Year 6',
};

export default WORDS;
