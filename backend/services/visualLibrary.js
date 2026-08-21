// backend/services/visualLibrary.js

/**
 * Curated catalog of direct iframe-embed PhET simulations.
 */
const PHET_SIMULATIONS = [
  {
    id: "phet-projectile-motion",
    aspect: "trajectory-drag",
    name: "Projectile Motion: Trajectory & Air Drag Lab",
    description: "Launch objects at varying angles and test the effects of air resistance and mass.",
    keywords: [
      "projectile", "trajectory", "angle", "launch", "cannon", "range",
      "height", "maximum height", "air resistance", "drag", "flight time",
      "parabola", "parabolic", "curved"
    ],
    embedUrl: "https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_all.html"
  },
  {
    id: "phet-vector-addition",
    aspect: "vector-components",
    name: "Vector Addition: 2D Velocity Components",
    description: "Decompose 2D motion into independent horizontal (Vx) and vertical (Vy) vector components.",
    keywords: [
      "vector", "vectors", "component", "components", "resultant", "magnitude",
      "direction", "horizontal velocity", "vertical velocity", "vx", "vy", "scalar"
    ],
    embedUrl: "https://phet.colorado.edu/sims/html/vector-addition/latest/vector-addition_all.html"
  },
  {
    id: "phet-forces-motion",
    aspect: "forces-acceleration",
    name: "Forces & Motion: Gravitational Acceleration",
    description: "Explore how unbalanced downward forces create constant acceleration in free-fall kinematics.",
    keywords: [
      "force", "forces", "motion", "friction", "acceleration", "newton",
      "net force", "mass", "inertia", "gravity", "free fall", "downward"
    ],
    embedUrl: "https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_all.html"
  },
  {
    id: "phet-gravity-force",
    aspect: "gravity-mass",
    name: "Gravity Force Lab",
    description: "Analyze how gravitational attraction and distance govern projectile acceleration.",
    keywords: ["gravity", "gravitational force", "attraction", "mass", "distance", "acceleration due to gravity"],
    embedUrl: "https://phet.colorado.edu/sims/html/gravity-force-lab-basics/latest/gravity-force-lab-basics_all.html"
  },
  {
    id: "phet-energy-skate-park",
    aspect: "energy-paths",
    name: "Energy Conservation on Curved Paths",
    description: "Track the exchange between kinetic and gravitational potential energy across curved trajectories.",
    keywords: ["kinetic energy", "potential energy", "conservation of energy", "mechanical energy", "track", "work"],
    embedUrl: "https://phet.colorado.edu/sims/html/energy-skate-park-basics/latest/energy-skate-park-basics_all.html"
  },
  {
    id: "phet-collision-lab",
    aspect: "momentum-collision",
    name: "Collision Lab: Momentum & Impulse",
    keywords: ["collision", "momentum", "elastic", "inelastic", "impact", "impulse"],
    embedUrl: "https://phet.colorado.edu/sims/html/collision-lab/latest/collision-lab_all.html"
  }
];

/**
 * Short (<90s) verified educational video clips.
 */
const YOUTUBE_ANIMATIONS = [
  {
    id: "anim-fired-vs-dropped",
    title: "Bullet Fired vs Dropped (Simultaneous Fall)",
    description: "⏱️ 60s • Demonstrates that horizontal velocity does not affect downward gravity fall time.",
    keywords: ["projectile", "trajectory", "gravity", "free fall", "horizontal", "vertical", "bullet", "dropped", "fired", "independence"],
    embedUrl: "https://www.youtube.com/embed/EIP2_z1Dm6U?rel=0&modestbranding=1"
  },
  {
    id: "anim-3d-projectile-basics",
    title: "3D Projectile Motion & Frame of Reference",
    description: "⏱️ 88s • 3D animated simulation of parabolic curves from inside and outside moving frames.",
    keywords: ["projectile", "motion", "velocity", "angle", "parabola", "trajectory", "curve", "horizontal", "vertical", "speed"],
    embedUrl: "https://www.youtube.com/embed/NvAeg_FrRwo?rel=0&modestbranding=1"
  },
  {
    id: "anim-soccer-ball-truck",
    title: "Vector Cancellation: Ball Shot from Moving Truck",
    description: "⏱️ 67s • Real-world demonstration of opposing velocity vectors canceling out completely.",
    keywords: ["vector", "vectors", "component", "components", "velocity", "addition", "speed", "cancel", "direction"],
    embedUrl: "https://www.youtube.com/embed/BLuI118nhzc?rel=0&modestbranding=1"
  },
  {
    id: "anim-range-formula",
    title: "Parabolic Trajectory & Maximum Range",
    description: "⏱️ 32s • Animation showing how launch angles affect apex and total horizontal range.",
    keywords: ["range", "height", "maximum height", "angle", "45 degree", "apex", "flight time", "distance"],
    embedUrl: "https://www.youtube.com/embed/N0H-rv9XFHk?rel=0&modestbranding=1"
  }
];

/**
 * Multi-tiered real-time diagram search across Wikipedia & Wikimedia.
 */
async function fetchRealtimeDiagrams(topicQuery, limit = 3) {
  const queryCandidates = [
    `${topicQuery} diagram`,
    `${topicQuery} physics`,
    "projectile motion trajectory diagram",
    "velocity vectors kinematics diagram"
  ];

  for (const q of queryCandidates) {
    try {
      const clean = encodeURIComponent(q.replace(/[^a-zA-Z0-9\s]/g, "").trim());
      const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${clean}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1000&format=json&origin=*`;

      const res = await fetch(endpoint, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SmartClassroomAI/1.0",
          "Accept": "application/json"
        }
      });

      if (!res.ok) continue;

      const data = await res.json();
      const pages = data?.query?.pages || {};
      const results = [];
      const seenUrls = new Set();

      for (const key in pages) {
        const page = pages[key];
        const info = page?.imageinfo?.[0];
        if (!info) continue;

        const targetUrl = info.thumburl || info.url;
        const mime = (info.mime || "").toLowerCase();

        // Ensure file is an image format (svg, png, jpg) and wide enough
        const isImg = mime.includes("svg") || mime.includes("png") || mime.includes("jpeg") || mime.includes("jpg");
        const isGoodRes = (info.width || 0) >= 250 || mime.includes("svg");

        if (isImg && isGoodRes && !seenUrls.has(targetUrl)) {
          seenUrls.add(targetUrl);

          const cleanTitle = (page.title || "Physics Educational Diagram")
            .replace(/^File:/i, "")
            .replace(/\.[^/.]+$/, "")
            .replace(/_/g, " ");

          results.push({
            id: `wiki-${page.pageid}`,
            title: cleanTitle,
            description: `Live educational diagram for ${topicQuery}.`,
            query: topicQuery,
            type: "diagram",
            provider: "Wikimedia Educational Visuals",
            url: targetUrl,
            embedUrl: targetUrl,
            imageUrl: targetUrl,
            link: targetUrl,
            src: targetUrl,
            embeddable: true,
            isDirectEmbed: true,
          });
        }

        if (results.length >= limit) break;
      }

      if (results.length > 0) {
        return results;
      }
    } catch (err) {
      console.warn(`Query attempt for "${q}" failed:`, err.message);
    }
  }

  return [];
}

/**
 * High-res self-contained fallback vector diagrams (guarantees content is never empty).
 */
function createSvgUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const GUARANTEED_FALLBACK_DIAGRAMS = [
  {
    id: "diag-trajectory-vector",
    title: "2D Projectile Trajectory Breakdown",
    description: "Vector diagram showing initial velocity v0, launch angle θ, maximum apex height, and horizontal range.",
    imageUrl: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="100%" height="100%">
        <rect width="600" height="340" fill="#ffffff" rx="8"/>
        <line x1="50" y1="280" x2="550" y2="280" stroke="#334155" stroke-width="2.5" />
        <line x1="50" y1="280" x2="50" y2="40" stroke="#334155" stroke-width="2.5" />
        <polygon points="550,280 540,274 540,286" fill="#334155"/>
        <polygon points="50,40 44,50 56,50" fill="#334155"/>
        <text x="535" y="305" font-family="sans-serif" font-size="14" font-weight="bold" fill="#334155">X (Range)</text>
        <text x="20" y="35" font-family="sans-serif" font-size="14" font-weight="bold" fill="#334155">Y (Height)</text>
        <path d="M 50,280 Q 280,20 510,280" fill="none" stroke="#2563eb" stroke-width="3.5" stroke-dasharray="6,4"/>
        <line x1="50" y1="280" x2="160" y2="150" stroke="#dc2626" stroke-width="3.5"/>
        <polygon points="160,150 148,158 156,166" fill="#dc2626"/>
        <text x="170" y="145" font-family="sans-serif" font-size="15" font-weight="bold" fill="#dc2626">v₀ (Initial Velocity)</text>
        <path d="M 90,280 A 40,40 0 0,0 82,245" fill="none" stroke="#e11d48" stroke-width="2"/>
        <text x="96" y="265" font-family="sans-serif" font-size="15" font-weight="bold" fill="#e11d48">θ</text>
        <line x1="280" y1="150" x2="280" y2="280" stroke="#059669" stroke-width="2" stroke-dasharray="4,4"/>
        <circle cx="280" cy="150" r="5" fill="#2563eb"/>
        <text x="290" y="145" font-family="sans-serif" font-size="13" font-weight="bold" fill="#059669">H_max = (v₀² sin²θ) / 2g</text>
        <line x1="50" y1="315" x2="510" y2="315" stroke="#4f46e5" stroke-width="2"/>
        <text x="220" y="333" font-family="sans-serif" font-size="14" font-weight="bold" fill="#4f46e5">R = (v₀² sin 2θ) / g</text>
      </svg>
    `)
  },
  {
    id: "diag-vectors-resolution",
    title: "Velocity Vector Components Resolution",
    description: "Breakdown of constant horizontal velocity (Vx = v0 cos θ) and gravitational vertical velocity (Vy = v0 sin θ - gt).",
    imageUrl: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="100%" height="100%">
        <rect width="600" height="340" fill="#ffffff" rx="8"/>
        <text x="140" y="30" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">Velocity Vector Component Resolution</text>
        <line x1="80" y1="260" x2="480" y2="260" stroke="#94a3b8" stroke-width="2"/>
        <line x1="80" y1="260" x2="80" y2="60" stroke="#94a3b8" stroke-width="2"/>
        <line x1="80" y1="260" x2="360" y2="90" stroke="#7c3aed" stroke-width="4"/>
        <polygon points="360,90 346,95 352,106" fill="#7c3aed"/>
        <text x="210" y="150" font-family="sans-serif" font-size="16" font-weight="bold" fill="#7c3aed">v₀</text>
        <line x1="80" y1="260" x2="360" y2="260" stroke="#2563eb" stroke-width="3.5"/>
        <polygon points="360,260 348,254 348,266" fill="#2563eb"/>
        <text x="160" y="285" font-family="sans-serif" font-size="15" font-weight="bold" fill="#2563eb">v_x = v₀ cos(θ) (Constant)</text>
        <line x1="80" y1="260" x2="80" y2="90" stroke="#059669" stroke-width="3.5"/>
        <polygon points="80,90 74,102 86,102" fill="#059669"/>
        <text x="95" y="100" font-family="sans-serif" font-size="15" font-weight="bold" fill="#059669">v_y = v₀ sin(θ) - gt</text>
      </svg>
    `)
  },
  {
    id: "diag-angles-comparison",
    title: "Launch Angles & Maximum Range Comparison",
    description: "Comparison showing max range at 45° and equal horizontal distances for complementary angles (30° and 60°).",
    imageUrl: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="100%" height="100%">
        <rect width="600" height="340" fill="#ffffff" rx="8"/>
        <text x="150" y="30" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">Trajectory Comparison for Launch Angles</text>
        <line x1="50" y1="280" x2="550" y2="280" stroke="#334155" stroke-width="2.5"/>
        <line x1="50" y1="280" x2="50" y2="50" stroke="#334155" stroke-width="2.5"/>
        <path d="M 50,280 Q 180,30 310,280" fill="none" stroke="#9333ea" stroke-width="2.5"/>
        <text x="180" y="55" font-family="sans-serif" font-size="12" font-weight="bold" fill="#9333ea">75°</text>
        <path d="M 50,280 Q 250,70 450,280" fill="none" stroke="#2563eb" stroke-width="2.5"/>
        <text x="250" y="90" font-family="sans-serif" font-size="12" font-weight="bold" fill="#2563eb">60°</text>
        <path d="M 50,280 Q 280,120 510,280" fill="none" stroke="#dc2626" stroke-width="3.5"/>
        <text x="280" y="140" font-family="sans-serif" font-size="13" font-weight="bold" fill="#dc2626">45° (Max Range)</text>
        <path d="M 50,280 Q 250,170 450,280" fill="none" stroke="#059669" stroke-width="2.5"/>
        <text x="350" y="210" font-family="sans-serif" font-size="12" font-weight="bold" fill="#059669">30° (Equal Range)</text>
      </svg>
    `)
  }
];

function selectUniqueSimulations(topicQuery, simCards = [], maxResults = 3) {
  const combinedTokens = `${topicQuery} ${simCards.map((c) => `${c.title || ""} ${c.query || ""}`).join(" ")}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scoredSims = PHET_SIMULATIONS.map((sim) => {
    let score = 0;
    for (const token of combinedTokens) {
      if (sim.id.includes(token)) score += 4;
      if (sim.name.toLowerCase().includes(token)) score += 3;
      if (sim.keywords.some((kw) => kw === token)) score += 2;
      else if (sim.keywords.some((kw) => kw.includes(token) || token.includes(kw))) score += 1;
    }
    return { sim, score };
  });

  scoredSims.sort((a, b) => b.score - a.score);

  const selected = [];
  const seenIds = new Set();
  const seenUrls = new Set();
  const seenAspects = new Set();

  for (const item of scoredSims) {
    const { sim, score } = item;
    if (seenIds.has(sim.id) || seenUrls.has(sim.embedUrl) || seenAspects.has(sim.aspect)) continue;

    if (score >= 2 || (selected.length === 0 && sim.id === "phet-projectile-motion")) {
      selected.push(sim);
      seenIds.add(sim.id);
      seenUrls.add(sim.embedUrl);
      seenAspects.add(sim.aspect);
    }
    if (selected.length >= maxResults) break;
  }
  return selected;
}

function findBestAnimations(queryText, count = 3) {
  const cleanTokens = (queryText || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((t) => t.length > 2);

  const scored = YOUTUBE_ANIMATIONS.map((anim) => {
    let score = 0;
    for (const token of cleanTokens) {
      if (anim.title.toLowerCase().includes(token)) score += 3;
      if (anim.keywords.some((kw) => kw.includes(token) || token.includes(kw))) score += 2;
    }
    return { anim, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const results = [];
  const seen = new Set();
  for (const item of scored) {
    if (!seen.has(item.anim.id)) {
      results.push(item.anim);
      seen.add(item.anim.id);
    }
    if (results.length >= count) break;
  }

  for (const fallback of YOUTUBE_ANIMATIONS) {
    if (results.length >= count) break;
    if (!seen.has(fallback.id)) {
      results.push(fallback);
      seen.add(fallback.id);
    }
  }
  return results.slice(0, count);
}

/**
 * Resolves all visual asset categories: Diagrams (Live search + Fallback), Simulations (PhET), and Animations (YouTube).
 */
async function resolveFlashcards(flashcards) {
  if (!flashcards) return { diagrams: [], animation: [], simulation: [] };
  const resolved = { diagrams: [], animation: [], simulation: [] };

  // 1. Resolve Diagrams
  const diagCards = flashcards.diagrams || flashcards["3d"] || [];
  const primaryTopic = diagCards.map((c) => `${c.title || ""} ${c.query || ""}`).join(" ") || "projectile motion";

  let diagrams = await fetchRealtimeDiagrams(primaryTopic, 3);

  // If live search returned fewer than 3, backfill with guaranteed vector graphics
  if (!diagrams || diagrams.length === 0) {
    diagrams = GUARANTEED_FALLBACK_DIAGRAMS.map((diag) => ({
      id: diag.id,
      title: diag.title,
      description: diag.description,
      query: primaryTopic,
      type: "diagram",
      provider: "Academic Physics Visuals",
      url: diag.imageUrl,
      embedUrl: diag.imageUrl,
      imageUrl: diag.imageUrl,
      link: diag.imageUrl,
      src: diag.imageUrl,
      embeddable: true,
      isDirectEmbed: true,
    }));
  }
  resolved.diagrams = diagrams;

  // 2. Resolve Simulations (Aspect-distinct PhET labs)
  const simCards = flashcards.simulation || [];
  const simTopic = simCards.map((c) => `${c.title || ""} ${c.query || ""}`).join(" ") || "projectile motion";
  const uniqueSims = selectUniqueSimulations(simTopic, simCards, 3);

  resolved.simulation = uniqueSims.map((sim) => ({
    id: sim.id,
    title: sim.name,
    description: sim.description,
    query: sim.keywords[0],
    type: "simulation",
    provider: "PhET Interactive Simulations",
    url: sim.embedUrl,
    embedUrl: sim.embedUrl,
    link: sim.embedUrl,
    src: sim.embedUrl,
    embeddable: true,
    isDirectEmbed: true,
  }));

  // 3. Resolve Animations (YouTube educational clips)
  const animCards = flashcards.animation || [];
  const animTopic = animCards.map((c) => `${c.title || ""} ${c.query || ""}`).join(" ") || "projectile motion vectors gravity";
  const matchedVideos = findBestAnimations(animTopic, 3);

  resolved.animation = matchedVideos.map((video, idx) => {
    const origCard = animCards[idx] || {};
    return {
      title: video.title || origCard.title || `Animation Demo ${idx + 1}`,
      description: video.description || origCard.description || "Short visual demonstration (<90s).",
      query: origCard.query || video.keywords[0],
      type: "animation",
      provider: "YouTube Demonstration",
      url: video.embedUrl,
      embedUrl: video.embedUrl,
      link: video.embedUrl,
      src: video.embedUrl,
      embeddable: true,
      isDirectEmbed: true,
    };
  });

  return resolved;
}

module.exports = {
  PHET_SIMULATIONS,
  YOUTUBE_ANIMATIONS,
  GUARANTEED_FALLBACK_DIAGRAMS,
  fetchRealtimeDiagrams,
  selectUniqueSimulations,
  findBestAnimations,
  resolveFlashcards,
};