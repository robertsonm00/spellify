// UK National Curriculum statutory spelling word lists, organised by year group.
// Year 3-4 and Year 5-6 are from the DfE statutory appendix.
// Year 1-2 use the Rose Review high-frequency / common exception word lists.

export const YEAR_DATA = {
  1: {
    year: 1,
    label: 'Year 1',
    ageRange: [5, 6],
    words: [
      'the','a','do','to','today','of','said','says','are','were','was','is',
      'his','has','you','your','they','be','he','she','we','me','no','my',
      'by','all','sure','come','some','here','there','when','what','one','out',
      'like','little','look','have','put','day','made','make','came','home',
      'old','time','back','very','much','door','only','who',
    ],
  },
  2: {
    year: 2,
    label: 'Year 2',
    ageRange: [6, 7],
    words: [
      'door','floor','poor','because','find','kind','mind','behind','child',
      'children','wild','climb','most','only','both','cold','gold','hold','told',
      'every','great','break','pretty','beautiful','after','fast','last','past',
      'father','class','grass','plant','path','bath','hour','move','prove',
      'improve','sure','sugar','eye','could','should','would','whole','any',
      'many','clothes','busy','people','water','again','half','money','everybody',
    ],
  },
  3: {
    year: 3,
    label: 'Year 3',
    ageRange: [7, 8],
    words: [
      'accident','actually','address','appear','arrive','believe','bicycle',
      'breath','breathe','build','busy','calendar','caught','centre','century',
      'certain','circle','complete','consider','continue','decide','describe',
      'different','difficult','disappear','early','earth','enough','exercise',
      'experience','experiment','extreme','famous','favourite','February',
      'forward','fruit','grammar','group','guard','guide','heard','heart',
    ],
  },
  4: {
    year: 4,
    label: 'Year 4',
    ageRange: [8, 9],
    words: [
      'height','history','imagine','increase','important','interest','island',
      'knowledge','learn','length','library','material','medicine','mention',
      'minute','natural','naughty','neighbour','notice','occasion','often',
      'opposite','ordinary','particular','peculiar','perhaps','popular',
      'position','possible','potatoes','pressure','probably','promise','purpose',
      'quarter','question','recent','regular','reign','remember','sentence',
      'separate','special','straight','strange','strength','suppose','surprise',
      'therefore','though','thought','through','various','weight','woman','women',
    ],
  },
  5: {
    year: 5,
    label: 'Year 5',
    ageRange: [9, 10],
    words: [
      'accommodate','accompany','aggressive','amateur','ancient','apparent',
      'appreciate','attached','available','average','awkward','bargain','bruise',
      'category','cemetery','committee','communicate','community','competition',
      'conscience','conscious','controversy','convenience','correspond',
      'criticise','curiosity','definite','desperate','determined','develop',
      'dictionary','disastrous','embarrass','environment','equip','especially',
      'exaggerate','excellent','existence','explanation','familiar','foreign',
    ],
  },
  6: {
    year: 6,
    label: 'Year 6',
    ageRange: [10, 11],
    words: [
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
  },
};

/** Convert age (5-11) to the most likely school year (1-6). */
export function ageToYear(age) {
  return Math.max(1, Math.min(6, age - 4));
}

/** Pick `count` random words from the given year (1-6). */
export function getWordsForYear(year, count = 20) {
  const data = YEAR_DATA[Math.max(1, Math.min(6, year))] || YEAR_DATA[3];
  const shuffled = [...data.words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Get the age range string for a year, e.g. "ages 7–8" */
export function getAgeRangeLabel(year) {
  const data = YEAR_DATA[year];
  if (!data) return '';
  return `ages ${data.ageRange[0]}–${data.ageRange[1]}`;
}

export const YEAR_LABELS = Object.fromEntries(
  Object.values(YEAR_DATA).map(({ year, label }) => [year, label])
);

export default YEAR_DATA;
