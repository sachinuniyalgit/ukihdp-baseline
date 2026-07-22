export interface ProjectFpo {
  district: string;
  block: string;
  blockAliases: string[];
  name: string;
  cbbo: string;
  focusCrops: string[];
  cropNote?: string;
  villages: string[];
}

export const projectFpos: ProjectFpo[] = [
  {
    district: "Nainital",
    block: "Ramgarh",
    blockAliases: ["Ramgarh"],
    name: "Ratandeep Farmer Producer Company Limited",
    cbbo: "Synergy",
    focusCrops: ["Peach"],
    villages: ["Bohrakot", "Hali", "Bajyuthiya", "Bameti", "Basgaon", "Chopda", "Dadim", "Harinagar", "Hartola", "Jhutia", "Kilaur", "Lodh", "Loshyani", "Malli Siloni", "Myoda", "Nekna", "Nathuvakhan", "Simayal", "Umagarh"],
  },
  {
    district: "Nainital",
    block: "Ramnagar",
    blockAliases: ["Ram Nagar", "Ramnagar"],
    name: "Ramnagar Bhawar Krishak Utpadan Sangathan Swayatt Sahkarita",
    cbbo: "Biocert International Private Limited",
    focusCrops: ["Litchi"],
    villages: ["Choi", "Chenpuri", "Manglar", "Jassangja", "Udaypuri Bandobasti", "Bhaguavangar", "Chilkiya", "LaxmipurBaniya", "Lutabad", "Kaniya", "Their", "Bastilia", "Sawaldey", "Umedpur", "Karanpur", "Berajhal", "Basai", "Himmatpur", "NayaJhirana", "Naya Laldhang", "Thari", "Beriya", "Sakkanpur", "Maldhan", "Naya gaon Chohan"],
  },
  {
    district: "Nainital",
    block: "Haldwani",
    blockAliases: ["Haldwani"],
    name: "Himalaya FPO",
    cbbo: "IFFDC",
    focusCrops: ["Tomato"],
    villages: ["Korpur", "Chorgaliya", "Kheda", "Devtalla", "Devmalla", "Selabhavar", "Baskhera"],
  },
  {
    district: "Nainital",
    block: "Bhimtal",
    blockAliases: ["Bheemtal", "Bhimtal"],
    name: "GuruGorakhnath FPO",
    cbbo: "IFFDC",
    focusCrops: ["Garlic"],
    villages: ["Chafi", "Alchona", "Hedagaon", "Songaon"],
  },
  {
    district: "Pithoragarh",
    block: "Munsyari",
    blockAliases: ["Munsyari"],
    name: "Chhipla Kedar FPO",
    cbbo: "IFFDC",
    focusCrops: ["Apple", "Potato"],
    cropNote: "Apple; Potato to be added",
    villages: ["Chouna", "Bona", "Imela", "Golfa"],
  },
  {
    district: "Pithoragarh",
    block: "Kanalicheena",
    blockAliases: ["Kanalichina", "Kanalicheena"],
    name: "Himshikhar Farmers Producer Company Limited",
    cbbo: "HIFEED",
    focusCrops: ["Citrus"],
    villages: ["Pali", "Chopaata", "Bichual", "Nawali", "Bachkote"],
  },
  {
    district: "Pithoragarh",
    block: "Didihat",
    blockAliases: ["Didihat"],
    name: "Monal Farmers Producer Company Limited",
    cbbo: "HIFEED",
    focusCrops: ["Ginger"],
    villages: ["Kuniya", "Dunakote", "Barna Airi", "Boragan", "Hat Tharp", "Jakh Dhulet", "Pamsyari"],
  },
  {
    district: "Pithoragarh",
    block: "Gangolihat",
    blockAliases: ["Gangolihat"],
    name: "Basukinag FPO",
    cbbo: "IFFDC",
    focusCrops: ["Garlic", "Kiwi"],
    cropNote: "Garlic; Kiwi to be incorporated",
    villages: ["Chauna", "Jhalota", "Chak", "Biroli", "Jadapani"],
  },
  {
    district: "Tehri Garhwal",
    block: "Thauldar",
    blockAliases: ["Thauldhar", "Thauldar"],
    name: "Sewa Saksham Farmer Producer Company Limited",
    cbbo: "Social Education and Welfare Association (SEWA)",
    focusCrops: ["Apple"],
    villages: ["Kyari", "Ghon", "Ghiyakoti", "Thirani", "Chapara", "Jhakogi"],
  },
  {
    district: "Tehri Garhwal",
    block: "Jaunpur",
    blockAliases: ["Janupur", "Jaunpur"],
    name: "Laloor Patti Fed Farmer Producer Company Limited",
    cbbo: "Clover Organic",
    focusCrops: ["Pea"],
    villages: ["Biror", "Bhutgaon", "Chhanigaon", "Devan", "Dhakrouli/Saltwad", "Ghansi", "Kainth", "Khairada", "Matli", "Miryaragaon", "Munogi", "Nakot", "Negiyana", "Tikari"],
  },
  {
    district: "Tehri Garhwal",
    block: "Chamba",
    blockAliases: ["Chamba"],
    name: "Sewa Lakshay Farmer Producer Company Limited",
    cbbo: "Social Education and Welfare Association (SEWA)",
    focusCrops: ["Potato"],
    villages: ["Jaspur", "Ghera", "Dungidhaar", "Jakh", "Nail", "Chopariyal"],
  },
  {
    district: "Tehri Garhwal",
    block: "Narendra Nagar",
    blockAliases: ["Narendra Nagar"],
    name: "Sewa Koshish Kisan Utpadak Swayatt Sahakarita",
    cbbo: "Social Education and Welfare Association (SEWA)",
    focusCrops: ["Ginger"],
    villages: ["Bhandar Gaon", "Kahnkar", "Dadwa", "Rampur", "Atali", "Kakarsari", "Maur", "Basui"],
  },
  {
    district: "Uttarkashi",
    block: "Mori",
    blockAliases: ["Mori"],
    name: "Veerangana Krishak Utpadak Sangathan FPO",
    cbbo: "Mount Valley Development Association",
    focusCrops: ["Apple"],
    villages: ["Kharsari", "Dobhal Gaon", "Ramal Gaon", "Nanai", "Bingsari", "Khedmi", "Devjani"],
  },
  {
    district: "Uttarkashi",
    block: "Naugaon",
    blockAliases: ["Naugaon"],
    name: "Yamunotri Fed Farmer Producer Company Limited",
    cbbo: "Synergy*",
    focusCrops: ["Walnut", "Tomato"],
    cropNote: "Walnut; Tomato as intercrop",
    villages: ["Tunalka", "Paletha", "Manjiyali", "Kimmi", "Naini", "Bingasi", "Pisau"],
  },
  {
    district: "Uttarkashi",
    block: "Bhatwari",
    blockAliases: ["Bhatwari"],
    name: "Upla Taknor Krishak Utpadak Sangathan Swayatt Sahkarita",
    cbbo: "Mount Valley Development Association",
    focusCrops: ["Potato"],
    villages: ["Raithal", "Dwari", "Natin"],
  },
  {
    district: "Uttarkashi",
    block: "Dunda",
    blockAliases: ["Dunda"],
    name: "Gangotri Fed FPCL",
    cbbo: "Synergy",
    focusCrops: ["Kiwi"],
    cropNote: "Gangotri Fed FPCL / Dhauntari in village Excel",
    villages: ["Dhauntari", "Dikholi", "Saud", "Bhetiyara", "Bhadkot", "Kamad", "Thandi"],
  },
];

export const projectMaster = {
  districts: [...new Set(projectFpos.map((item) => item.district))],
  focusCrops: [...new Set(projectFpos.flatMap((item) => item.focusCrops))].sort(),
  youthAgeRange: null as null | { min: number; max: number },
};

export function blocksForDistrict(district: string) {
  return projectFpos.filter((item) => item.district === district).map((item) => item.block);
}

export function fposForLocation(district: string, block: string) {
  return projectFpos.filter((item) => item.district === district && (item.block === block || item.blockAliases.includes(block)));
}

export function findFpo(name: string) {
  return projectFpos.find((item) => item.name === name);
}
