'use strict';

// ============================================================
// TERMINAL ELITE HORIZON — Configuration & Données Portefeuille
// ============================================================

const CONFIG = {
  DCA_MONTHLY:       125,      // DCA mensuel (€)
  TICK_INTERVAL:    3000,      // Intervalle simulation (ms)
  INTRADAY_POINTS:   120,      // Points historique intraday
  MONTE_CARLO_RUNS:  600,      // Simulations Monte Carlo
  MONTE_CARLO_DAYS:  365,      // Horizon projection (jours)
  API_RETRY_INTERVAL: 60000,   // Retry Yahoo Finance (ms)
};

// ============================================================
// PORTEFEUILLE – 14 LIGNES ACTIVES (CTO + PEA)
// DEFAULT_PORTFOLIO = template de référence (cloné pour chaque nouvel utilisateur)
// PORTFOLIO         = variable de travail, peuplée après authentification
// ============================================================

const DEFAULT_PORTFOLIO = [
  // ── CTO ──────────────────────────────────────────────────
  {
    id: 1, ticker: 'NVDA',  name: 'NVIDIA Corporation',
    pru: 16.03, qty: 50, account: 'CTO',
    sector: 'Semi-conducteurs', country: 'US', currency: 'USD',
    dividendYield: 0.02, volatility: 0.45, drift: 0.22,
    color: '#76b900',
    description: 'Leader mondial GPU & IA. Moteur principal du boom datacenter avec les architectures Hopper et Blackwell.',
  },
  {
    id: 2, ticker: 'AMD',   name: 'Advanced Micro Devices',
    pru: 85.20, qty: 5, account: 'CTO',
    sector: 'Semi-conducteurs', country: 'US', currency: 'USD',
    dividendYield: 0, volatility: 0.50, drift: 0.18,
    color: '#ed1c24',
    description: 'Rival de NVIDIA sur GPU IA. Parts de marché en hausse dans les serveurs avec l\'architecture CDNA.',
  },
  {
    id: 3, ticker: 'TSM',   name: 'Taiwan Semiconductor Mfg',
    pru: 102.40, qty: 8, account: 'CTO',
    sector: 'Semi-conducteurs', country: 'TW', currency: 'USD',
    dividendYield: 1.5, volatility: 0.32, drift: 0.16,
    color: '#ff6b35',
    description: 'Le fondeur le plus avancé au monde. Client NVDA, AMD, Apple. Nœud 2nm en production 2026.',
  },
  {
    id: 4, ticker: 'AVGO',  name: 'Broadcom Inc.',
    pru: 980.00, qty: 1, account: 'CTO',
    sector: 'Semi-conducteurs', country: 'US', currency: 'USD',
    dividendYield: 1.8, volatility: 0.28, drift: 0.15,
    color: '#cc0000',
    description: 'Diversifié semi + logiciels (VMware). Flux de trésorerie robuste, dividende en croissance constante.',
  },
  {
    id: 5, ticker: 'QCOM',  name: 'Qualcomm Inc.',
    pru: 125.50, qty: 4, account: 'CTO',
    sector: 'Semi-conducteurs', country: 'US', currency: 'USD',
    dividendYield: 2.2, volatility: 0.30, drift: 0.12,
    color: '#3253dc',
    description: 'Leader modem 5G. Diversification vers PC (Snapdragon X) et automobile (Snapdragon Ride).',
  },
  {
    id: 6, ticker: 'LRCX',  name: 'Lam Research Corp.',
    pru: 650.00, qty: 2, account: 'CTO',
    sector: 'Équipements Semi', country: 'US', currency: 'USD',
    dividendYield: 1.1, volatility: 0.38, drift: 0.14,
    color: '#0070c0',
    description: 'Équipementier clé (gravure ALD/ALE). Bénéficiaire direct de la reprise du capex mémoire (NAND/DRAM).',
  },
  {
    id: 7, ticker: 'AMAT',  name: 'Applied Materials Inc.',
    pru: 145.00, qty: 5, account: 'CTO',
    sector: 'Équipements Semi', country: 'US', currency: 'USD',
    dividendYield: 0.9, volatility: 0.35, drift: 0.13,
    color: '#005f87',
    description: 'N°1 mondial équipements semi. Segment AGS (services) apporte récurrence et visibilité.',
  },
  {
    id: 8, ticker: 'MRVL',  name: 'Marvell Technology Inc.',
    pru: 52.30, qty: 10, account: 'CTO',
    sector: 'Semi-conducteurs', country: 'US', currency: 'USD',
    dividendYield: 0.4, volatility: 0.48, drift: 0.20,
    color: '#e84393',
    description: 'ASIC IA custom et DSP 800G. Fort momentum sur la connectique datacenter haute vitesse.',
  },
  {
    id: 9, ticker: 'MSFT',  name: 'Microsoft Corporation',
    pru: 285.00, qty: 3, account: 'CTO',
    sector: 'Technologie', country: 'US', currency: 'USD',
    dividendYield: 0.7, volatility: 0.22, drift: 0.14,
    color: '#00a4ef',
    description: 'Couplé à OpenAI, Azure IA. Blue chip défensive. Copilot 365 à 85M d\'utilisateurs entreprise.',
  },
  // ── PEA ──────────────────────────────────────────────────
  {
    id: 10, ticker: 'ASML',  name: 'ASML Holding N.V.',
    pru: 520.00, qty: 3, account: 'PEA',
    sector: 'Semi-conducteurs', country: 'NL', currency: 'EUR',
    dividendYield: 0.8, volatility: 0.30, drift: 0.14,
    color: '#0097ce',
    description: 'Monopole mondial machines EUV. Clé de voûte de la chaîne semi mondiale. Backlog >€20 Mrd.',
  },
  {
    id: 11, ticker: 'DSY',   name: 'Dassault Systèmes SE',
    pru: 35.50, qty: 15, account: 'PEA',
    sector: 'Logiciels', country: 'FR', currency: 'EUR',
    dividendYield: 0.6, volatility: 0.28, drift: 0.10,
    color: '#003189',
    description: 'Leader CAO et PLM (3DEXPERIENCE). Croissance stable, MEDIDATA en traction dans le pharma.',
  },
  {
    id: 12, ticker: 'CAP',   name: 'Capgemini SE',
    pru: 168.00, qty: 4, account: 'PEA',
    sector: 'Tech Services', country: 'FR', currency: 'EUR',
    dividendYield: 1.7, volatility: 0.25, drift: 0.09,
    color: '#0070ad',
    description: 'Services IT et conseil. Méga-contrats cloud en accélération, marge opérationnelle en hausse.',
  },
  {
    id: 13, ticker: 'STM',   name: 'STMicroelectronics N.V.',
    pru: 28.50, qty: 20, account: 'PEA',
    sector: 'Semi-conducteurs', country: 'NL', currency: 'EUR',
    dividendYield: 0.5, volatility: 0.42, drift: 0.06,
    color: '#1d7ec2',
    description: 'Semi-conducteurs européens. Secteur automobile sous pression. Maintient leadership SiC #2 mondial.',
  },
  {
    id: 14, ticker: 'SOI',   name: 'Soitec SA',
    pru: 95.00, qty: 5, account: 'PEA',
    sector: 'Semi-conducteurs', country: 'FR', currency: 'EUR',
    dividendYield: 0, volatility: 0.50, drift: 0.06,
    color: '#39b54a',
    description: 'Matériaux semi-conducteurs SOI. Pression sur RF/mobile, traction PowerSOI automotive/IoT.',
  },
];

// Variable de travail — peuplée après auth depuis localStorage (ou clonée depuis DEFAULT_PORTFOLIO)
let PORTFOLIO = [];

// ============================================================
// PRIX DE BASE — Simulation Avril 2026 (€)
// ============================================================

const BASE_PRICES = {
  'NVDA': 856.40,  'AMD':  108.50,  'TSM':  148.20,  'AVGO': 1124.00,
  'QCOM': 138.30,  'LRCX': 712.00,  'AMAT': 162.50,  'MRVL':   61.80,
  'MSFT': 325.00,  'ASML': 678.00,  'DSY':   37.80,  'CAP':   174.50,
  'STM':   21.40,  'SOI':   86.50,
};

// Prix courants (mis à jour à chaque tick)
let CURRENT_PRICES  = { ...BASE_PRICES };
// Prix d'ouverture de la session
let DAILY_OPENS     = { ...BASE_PRICES };
// Historique intraday { ticker: [{time, price}] }
let PRICE_HISTORY   = {};

// ============================================================
// ACTUALITÉS MACRO — Pool rotatif
// ============================================================

const MACRO_NEWS = [
  {
    id: 'm1', category: 'IA & Semi',
    title: 'Demande GPU IA : les commandes dépassent les prévisions de 40% au T1 2026',
    body: 'Les hyperscalers (Microsoft, Google, Amazon, Meta) accélèrent leurs dépenses capex en IA. NVIDIA ne peut livrer assez vite — les délais atteignent 9 mois sur les GPU Blackwell B200. TSMC reste le seul fondeur capable de produire à ce nœud.',
    impact: { rating: 'haussier', score: +8 },
    horizons: { '1J': 'haussier', '1S': 'haussier', 'LT': 'haussier' },
    affected: ['NVDA', 'AMD', 'TSM', 'MRVL', 'ASML'],
    time: '08:42', source: 'Bloomberg Intelligence',
  },
  {
    id: 'm2', category: 'FED',
    title: 'La Fed maintient ses taux à 4.75% — Pause prolongée jusqu\'à l\'été',
    body: 'La Réserve Fédérale américaine a maintenu ses taux directeurs inchangés. Le président Powell a indiqué que "des données supplémentaires seront nécessaires" avant d\'envisager une baisse. Les marchés repoussent leurs anticipations au T3 2026.',
    impact: { rating: 'neutre', score: -1 },
    horizons: { '1J': 'neutre', '1S': 'baissier', 'LT': 'haussier' },
    affected: ['MSFT', 'NVDA', 'QCOM', 'ASML', 'CAP'],
    time: '20:15', source: 'Federal Reserve',
  },
  {
    id: 'm3', category: 'Géopolitique',
    title: 'Nouvelles restrictions export US sur semi avancés vers la Chine',
    body: 'Le département du Commerce américain a publié de nouvelles règles restreignant l\'export de semi-conducteurs avancés. Les puces IA dépassant un certain seuil de performance sont soumises à licence. Impact estimé : -15 à 20% du backlog China pour les acteurs américains.',
    impact: { rating: 'baissier', score: -5 },
    horizons: { '1J': 'baissier', '1S': 'baissier', 'LT': 'neutre' },
    affected: ['NVDA', 'AMD', 'QCOM', 'AMAT', 'LRCX'],
    time: '14:30', source: 'Reuters',
  },
  {
    id: 'm4', category: 'Europe',
    title: 'EU CHIPS Act : €4 Mrd supplémentaires pour les fabs européennes',
    body: 'La Commission Européenne annonce un financement additionnel pour renforcer la souveraineté technologique. STMicroelectronics et Soitec sont parmi les bénéficiaires potentiels. ASML bénéficierait indirectement d\'une hausse de la demande EUV européenne.',
    impact: { rating: 'haussier', score: +6 },
    horizons: { '1J': 'neutre', '1S': 'haussier', 'LT': 'haussier' },
    affected: ['STM', 'SOI', 'ASML'],
    time: '10:00', source: 'European Commission',
  },
  {
    id: 'm5', category: 'Résultats',
    title: 'Saison T1 2026 : Attentes records pour la Tech américaine (+28% BPA)',
    body: 'Les analystes anticipent une croissance des bénéfices de +28% YoY pour le secteur tech. NVIDIA attendu avec un BPA de $6.20 contre $5.80 au Q4 2025. La barre est haute — le moindre miss pourrait décevoir.',
    impact: { rating: 'haussier', score: +7 },
    horizons: { '1J': 'neutre', '1S': 'haussier', 'LT': 'haussier' },
    affected: ['NVDA', 'MSFT', 'AVGO', 'AMD', 'QCOM'],
    time: '09:15', source: 'Goldman Sachs Research',
  },
  {
    id: 'm6', category: 'Inflation',
    title: 'CPI US à 3.1% en mars — Légèrement au-dessus des attentes (2.9%)',
    body: 'L\'inflation américaine reste au-dessus de l\'objectif 2% de la Fed. Les marchés obligataires se tendent. Les valeurs de croissance à duration longue pourraient être pénalisées à court terme.',
    impact: { rating: 'baissier', score: -3 },
    horizons: { '1J': 'baissier', '1S': 'neutre', 'LT': 'neutre' },
    affected: ['MSFT', 'ASML', 'DSY', 'CAP', 'NVDA'],
    time: '14:30', source: 'Bureau of Labor Statistics',
  },
  {
    id: 'm7', category: 'M&A',
    title: 'Broadcom : synergies VMware à +$1.8 Mrd — Au-dessus des prévisions',
    body: 'Broadcom confirme que l\'intégration de VMware génère des synergies supérieures aux prévisions initiales. La division logiciels représente désormais 55% du CA total. Le management relève le dividende de 12%.',
    impact: { rating: 'haussier', score: +5 },
    horizons: { '1J': 'haussier', '1S': 'haussier', 'LT': 'haussier' },
    affected: ['AVGO'],
    time: '07:30', source: 'Broadcom IR',
  },
  {
    id: 'm8', category: 'Supply Chain',
    title: 'Pénurie silicium ultra-pur : alerte sur les délais de livraison H2 2026',
    body: 'Des tensions sur les matières premières critiques (silicium, gaz spéciaux) pourraient affecter la production de plusieurs fabs asiatiques. Soitec et STM pourraient bénéficier d\'une revalorisation de leurs matériaux souverains.',
    impact: { rating: 'baissier', score: -4 },
    horizons: { '1J': 'neutre', '1S': 'baissier', 'LT': 'baissier' },
    affected: ['TSM', 'STM', 'SOI', 'AMAT', 'LRCX'],
    time: '11:20', source: 'Nikkei Asia',
  },
];

// ============================================================
// ACTUALITÉS PAR ACTION
// ============================================================

const STOCK_NEWS = {
  'NVDA': [
    { title: 'NVIDIA Blackwell Ultra B300X : performance IA x3 vs H100', body: 'Lors de la GTC 2026, Jensen Huang a dévoilé le B300X. La puce affiche 3x plus de performance sur les workloads LLM avec une consommation réduite de 20%. Toutes les grandes plateformes cloud précommandent.', time: '3h', sentiment: 'haussier' },
    { title: 'Microsoft : commande de 50 000 GPU H200 supplémentaires (~$2 Mrd)', body: 'Microsoft Azure étend son infrastructure IA avec une commande massive. Le contrat, estimé à $2 milliards, confirme que la demande dépasse largement l\'offre disponible.', time: '1j', sentiment: 'haussier' },
    { title: 'Restrictions export Chine : NVIDIA perd ~$800M de revenus estimés', body: 'Les nouvelles règles du BIS américain réduisent l\'adressable marché chinois de NVIDIA. La société explore des configurations alternatives conformes. Impact limité au regard du reste du backlog mondial.', time: '2j', sentiment: 'baissier' },
  ],
  'AMD': [
    { title: 'MI350X : adoption en hausse chez Google et Meta', body: 'Google et Meta confirment le déploiement du MI350X dans leurs clusters IA. AMD gagne 3 points de part de marché GPU datacenter selon Bernstein Research.', time: '5h', sentiment: 'haussier' },
    { title: 'CPU EPYC Turin : supérieur à Intel Xeon dans 87% des benchmarks', body: 'Les tests indépendants d\'AnandTech confirment la supériorité du Turin dans 87% des workloads HPC. Dell et HP ajoutent les configurations AMD à leur catalogue serveur standard.', time: '2j', sentiment: 'haussier' },
    { title: 'Q4 2025 : CA +22% YoY, guidance Q1 légèrement prudente', body: 'AMD publie des résultats solides mais une guidance Q1 légèrement sous le consensus inquiète sur la saisonnalité. La réaction reste mesurée car le momentum long terme est intact.', time: '5j', sentiment: 'neutre' },
  ],
  'TSM': [
    { title: 'TSMC 2nm : production démarrage avancé en Q3 2026', body: 'Le PDG C.C. Wei confirme que les rendements du nœud 2nm dépassent les objectifs internes. Apple, NVIDIA et AMD sont les clients de lancement confirmés.', time: '1j', sentiment: 'haussier' },
    { title: 'Arizona fab : retard de 6 mois, les subventions CHIPS Act maintenues', body: 'L\'usine de Phoenix accuse un retard supplémentaire lié à la qualification des équipements. Washington maintient les $6.6 Mrd de subventions accordées.', time: '3j', sentiment: 'neutre' },
    { title: 'Tensions détroit de Taïwan : prime de risque géopolitique en hausse', body: 'Les analystes réévaluent le risque géopolitique suite à des exercices militaires chinois. JPMorgan augmente la prime de risque de 50bps mais maintient son objectif cours.', time: '4j', sentiment: 'baissier' },
  ],
  'AVGO': [
    { title: 'Dividende trimestriel relevé à $5.25 (+12%) — 14ème hausse consécutive', body: 'Le conseil d\'administration de Broadcom a approuvé une hausse significative du dividende trimestriel, reflétant la solidité des flux combinés semi + logiciels.', time: '2j', sentiment: 'haussier' },
    { title: 'VMware Cloud Foundation : +35% de nouveaux contrats au Q4 2025', body: 'Les ventes de licences VCF dépassent les attentes. L\'intégration VMware génère des synergies à $1.8 Mrd, au-dessus des prévisions initiales.', time: '4j', sentiment: 'haussier' },
  ],
  'QCOM': [
    { title: 'Snapdragon X Elite : 18 nouveaux laptops Windows AI en 2026', body: 'Qualcomm confirme des design wins supplémentaires dans le PC IA. La division QCT représente désormais 78% du CA avec une expansion vers l\'Edge computing.', time: '6h', sentiment: 'haussier' },
    { title: 'Automotive : 5 contrats Snapdragon Ride avec constructeurs asiatiques', body: 'Geely, BYD, Hyundai, Kia et Mazda adoptent la plateforme Snapdragon Ride. Le backlog automotive de Qualcomm dépasse $10 Mrd pour la première fois.', time: '3j', sentiment: 'haussier' },
  ],
  'LRCX': [
    { title: 'Reprise NAND/DRAM : Lam Research relève sa guidance Q1 2026', body: 'La reprise du capex mémoire bénéficie directement à Lam Research. Samsung et Micron augmentent leurs commandes d\'équipements ALD/ALE. Le carnet progresse de +18% QoQ.', time: '1j', sentiment: 'haussier' },
    { title: 'Gate-all-around (GAA) : Lam se positionne pour les nœuds <2nm', body: 'Les équipements de dépôt atomique de Lam sont indispensables pour la transition vers l\'architecture GAA. Un avantage durable face à la concurrence japonaise.', time: '4j', sentiment: 'haussier' },
  ],
  'AMAT': [
    { title: 'Plan R&D pour nœud 1nm : AMAT investit $2 Mrd sur 3 ans', body: 'Applied Materials annonce un plan d\'investissement pluriannuel pour les équipements sub-2nm, renforçant sa position de leader pour la prochaine décennie de lithographie avancée.', time: '2j', sentiment: 'haussier' },
    { title: 'Services AGS : +11% YoY — Récurrence et marges en progression', body: 'Le segment AGS représente 25% du CA avec une marge >55%. Cette récurrence rassure les investisseurs sur la résilience du modèle face aux cycles semi.', time: '5j', sentiment: 'haussier' },
  ],
  'MRVL': [
    { title: 'ASIC IA custom : contrat $500M sur 3 ans avec un hyperscaler non nommé', body: 'Marvell Technology annonce un méga-contrat de développement de puce IA custom. Le pipeline ASIC compte désormais 6 projets actifs avec les grandes plateformes cloud mondiales.', time: '4h', sentiment: 'haussier' },
    { title: 'PAM4 DSP 800G : Marvell détient 45% de part de marché', body: 'Les modules optiques 800G pour datacenters adoptent massivement les DSP Marvell. Le segment 1.6T est en précommande pour H2 2026. Momentum exceptionnel.', time: '2j', sentiment: 'haussier' },
  ],
  'MSFT': [
    { title: 'Azure IA : +13% de croissance additionnelle grâce aux services IA', body: 'Microsoft divulgue pour la première fois la contribution IA à Azure : +13% de croissance additionnelle. Azure dépasse 30% de part de marché cloud pour la première fois.', time: '1j', sentiment: 'haussier' },
    { title: 'Copilot 365 : 85 millions d\'utilisateurs entreprise actifs', body: 'L\'adoption de Copilot M365 dépasse les prévisions avec 85M d\'utilisateurs actifs, générant $30/utilisateur/mois. Un vecteur de croissance massif pour la division Productivity.', time: '3j', sentiment: 'haussier' },
    { title: 'Q2 FY2026 : BPA $3.65 vs $3.55 attendu (+2.8% beat)', body: 'Microsoft publie des résultats supérieurs avec forte exécution sur Azure, Dynamics et Gaming. La marge opérationnelle s\'améliore de 120bps.', time: '5j', sentiment: 'haussier' },
  ],
  'ASML': [
    { title: 'Backlog EUV au plus haut historique : >€20 Mrd', body: 'Le carnet de commandes d\'ASML dépasse €20 milliards, porté par des commandes record de TSMC, Samsung et Intel pour les systèmes High-NA EUV nécessaires aux nœuds <2nm.', time: '8h', sentiment: 'haussier' },
    { title: 'High-NA EUV : premier système livré à IMEC pour qualification', body: 'La génération suivante des machines EUV est en phase de qualification chez IMEC. Le High-NA permettra les nœuds en-dessous de 1nm — seul ASML peut le produire.', time: '3j', sentiment: 'haussier' },
    { title: 'Restrictions Chine : impact limité à 15% du backlog, dit ASML', body: 'ASML rassure : les restrictions n\'affectent que 15% du carnet. La demande des clients hors Chine (TSMC, Samsung, Intel, SK Hynix) compense largement.', time: '5j', sentiment: 'neutre' },
  ],
  'DSY': [
    { title: 'MEDIDATA : 12 contrats pharma top-20 au Q1 2026', body: 'La division Life Sciences signe avec 12 des 20 plus grands laboratoires pharmaceutiques mondiaux. MEDIDATA contribue +18% à la croissance organique globale du groupe.', time: '1j', sentiment: 'haussier' },
    { title: '3DEXPERIENCE : adoption industrie 4.0 en accélération (Stellantis, VW)', body: 'La plateforme 3DEXPERIENCE s\'impose dans la transformation digitale automobile. Nouveaux contrats pluri-annuels avec Stellantis et Volkswagen annoncés.', time: '4j', sentiment: 'haussier' },
  ],
  'CAP': [
    { title: 'Méga-contrat cloud transformation €800M sur 5 ans', body: 'Capgemini remporte un méga-contrat de transformation cloud avec un grand groupe industriel européen — l\'un des plus importants de son histoire, confirmant son positionnement premium.', time: '2j', sentiment: 'haussier' },
    { title: 'Marge opérationnelle Q4 2025 : 13.2% — Au-dessus des objectifs', body: 'Capgemini améliore sa marge à 13.2%, bénéficiant des offres IA haute valeur. La politique de dividende progressive est confirmée.', time: '5j', sentiment: 'haussier' },
  ],
  'STM': [
    { title: 'STM abaisse sa guidance 2026 : automobile européen en recul', body: 'STMicroelectronics révise à la baisse ses prévisions de CA 2026 suite au ralentissement automobile européen. Le titre a déjà intégré beaucoup de mauvaises nouvelles (-38% depuis le plus haut).', time: '2j', sentiment: 'baissier' },
    { title: 'Silicon Carbide SiC : STM maintient #2 mondial malgré la pression', body: 'Malgré la concurrence de Wolfspeed et Infineon, STM conserve sa place de #2 mondial sur les semi SiC pour l\'automobile électrique. Repositionnement en cours vers l\'industriel.', time: '5j', sentiment: 'neutre' },
  ],
  'SOI': [
    { title: 'Soitec : contraction RF/mobile pèse sur les revenus H1 2026', body: 'Le ralentissement smartphone et la décélération du déploiement 5G freinent les livraisons de substrats SOI de Soitec. Révision à la baisse des estimations du sell-side.', time: '3j', sentiment: 'baissier' },
    { title: 'PowerSOI : traction automobile et IoT compense partiellement le recul RF', body: 'La demande pour substrats PowerSOI (automobile, IoT) progresse de +22%. Ne compense pas intégralement le recul RF/mobile, mais ouvre un relais de croissance structurel.', time: '6j', sentiment: 'neutre' },
  ],
};
