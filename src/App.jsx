import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls, Stars, useCursor } from '@react-three/drei';
import { BackSide, CatmullRomCurve3, DoubleSide, Vector3 } from 'three';

const ROAD_LENGTH = 140;
const ROAD_START = 28;
const PAIR_COUNT = 18;
const PAIR_STEP = 8;
const POLE_OFFSET = 5.6;
const ARM_REACH = 1.6;
const HUB_POSITION = [0, 10.5, -44];
const TRAFFIC_FRONT = 26;
const TRAFFIC_SPAN = ROAD_LENGTH + 18;
const COMMUNICATION_BEACON = [0, 7.2, -18];
// Each pole gap represents roughly 100 meters, so a 1 km turn zone spans about 10 posts.
const METERS_BETWEEN_LIGHT_POSTS = 100;
const TURN_LIGHT_DISTANCE_METERS = 1000;
const TURN_TRIGGER_DISTANCE_METERS = 320;
const TURN_LIGHT_POSTS = TURN_LIGHT_DISTANCE_METERS / METERS_BETWEEN_LIGHT_POSTS;
const TURN_ZONE_HALF_POSTS = Math.floor(TURN_LIGHT_POSTS / 2);
const TURN_TRIGGER_WORLD = (TURN_TRIGGER_DISTANCE_METERS / METERS_BETWEEN_LIGHT_POSTS) * PAIR_STEP;
const TRAFFIC_LOCAL_LIGHT_RANGE = 22;
const TRAFFIC_FORWARD_LIGHT_RANGE = 78;
const TRAFFIC_FORWARD_WAVE_RANGE = 118;
const MAIN_ROAD_SURFACE_WIDTH = 12;
const MAIN_ROAD_HALF_WIDTH = MAIN_ROAD_SURFACE_WIDTH / 2;
const SIDEWALK_WIDTH = 3.6;
const LOT_STRIP_WIDTH = 8.6;
const SIDE_ROAD_LENGTH = 18.5;
const SIDE_ROAD_WIDTH = 5.2;
const SIDE_ROAD_JUNCTION_OVERLAP = 1.1;
const SIDE_ROAD_JUNCTION_PATCH = 2.4;
const SIDE_ROAD_LIGHT_OFFSETS = [4.2, 9.6, 15.2];
const SIDE_ROAD_LIGHT_Z_OFFSETS = [-1.6, 1.6];
const SIDE_ROAD_DASH_OFFSETS = [4.4, 9.8, 15.1];
const OVERLAY_PAIR_RANGE = 2;
const TURN_LAYOUTS = [
  { id: 't-left', pair: 5, side: 'left' },
  { id: 't-right', pair: 11, side: 'right' },
];
const TRAFFIC_CARS = [
  { id: 'car-southbound', laneX: -2.05, speed: 0.05, offset: 0.12, color: '#ffc36f', direction: 'south' },
];

const popupContent = {
  led: {
    title: 'Smart LED-armatur',
    text:
      'Varje ljuspunkt bygger på dimbar LED-teknik. Det gör att systemet kan gå från ett tryggt basljus till starkare ljus exakt när det behövs, utan att hela vägen måste ligga på full nivå hela natten.',
    bullets: [
      'LED är grunden i hela lösningen och gör dimring möjlig utan att förlora kontroll.',
      'Ger lägre elanvändning än äldre belysning redan innan sensorstyrningen aktiveras.',
      'Passar ett stegvis införande där kommunen bygger vidare på det som redan finns.',
    ],
    tags: ['Dimbar LED', 'Basljus + uppdimring', 'Stegvis uppgradering'],
  },
  sensor: {
    title: 'Sensorstyrning',
    text:
      'Varje station har en egen sensor som känner av människor, cyklar och fordon. När aktivitet upptäcks skickas en signal som dimrar upp rätt del av stråket, så att ljuset används där det faktiskt behövs.',
    bullets: [
      'Särskilt stark lösning för GC-vägar, parker, tunnlar och bostadsnära gator.',
      'Gör att belysningen reagerar på verklig användning i stället för fasta nattnivåer.',
      'Kan kombineras med olika profiler beroende på typ av miljö.',
    ],
    tags: ['Rörelsedetektering', 'Snabb respons', 'Behovsstyrt ljus'],
  },
  adaptive: {
    title: 'Adaptiv dimring',
    text:
      'Systemet släcker inte ner staden planlöst. I stället ligger ett läsbart basljus kvar och förstärks när sensorn registrerar rörelse eller när bilar närmar sig ett stråk. Det skapar en balans mellan trygghet och energibesparing.',
    bullets: [
      'Högre basnivå på huvudgator och konfliktzoner där trygghet och synbarhet är extra viktiga.',
      'Lägre nivåer i miljöer där trafikflödet varierar mycket över dygnet.',
      'Det är denna modell som gör huvudförslaget realistiskt, inte extremt.',
    ],
    tags: ['Basljus', 'Uppdimring', 'Trygghet först'],
  },
  controller: {
    title: 'Controller på varje station',
    text:
      'Varje station har en liten controller direkt på stolpen. Det gör lösningen tydligare, mer skalbar och billigare att bygga ut än att förlita sig på stora separata enheter överallt i stråket.',
    bullets: [
      'Binder ihop sensorn, LED-armaturen och CMS-kommunikationen i samma station.',
      'Möjliggör olika styrprofiler för olika delar av vägen.',
      'Kompakt station-för-station-lösning gör utrullningen billigare och enklare att skala upp.',
    ],
    tags: ['På stolpen', 'Lokal logik', 'Billigare att skala'],
  },
  communication: {
    title: 'Så kommunicerar systemet',
    text:
      'När en ljuspunkt eller en bil aktiverar systemet skickas information längs nätet till närliggande stolpar och vidare till CMS. I praktiken betyder det att ett helt stråk kan reagera tillsammans, i stället för att varje stolpe arbetar isolerat.',
    bullets: [
      'Signal går mellan närliggande ljuspunkter för att förbereda nästa del av vägen.',
      'Data skickas också upp till den centrala plattformen för övervakning och analys.',
      'Det ger både bättre ljuslogik i stunden och bättre driftdata över tid.',
    ],
    tags: ['Nätverk', 'Samverkande stolpar', 'Signal till CMS'],
  },
  cms: {
    title: 'CMS och fjärrövervakning',
    text:
      'Varje station är kopplad till CMS via sin egen nod på stolpen. Det centrala systemet samlar sedan in data från hela nätet så att kommunen kan se energianvändning, larm, fel och driftstatus i samma översikt.',
    bullets: [
      'Varje station skickar upp status och händelser till CMS.',
      'Gör det lättare att hitta fel och underhållsbehov snabbare.',
      'Kopplar ihop hållbarhet, ekonomi och drift i samma systembild.',
    ],
    tags: ['CMS-nod per station', 'Fjärrövervakning', 'Driftdata'],
  },
};

function getPairZ(index) {
  return ROAD_START - index * PAIR_STEP;
}

const roadPairs = Array.from({ length: PAIR_COUNT }, (_, index) => {
  const z = getPairZ(index);

  return {
    pair: index,
    z,
    leftBase: [-POLE_OFFSET, 0, z],
    rightBase: [POLE_OFFSET, 0, z],
    leftNode: [-POLE_OFFSET + ARM_REACH, 4.1, z],
    rightNode: [POLE_OFFSET - ARM_REACH, 4.1, z],
  };
});

const turnRoads = TURN_LAYOUTS.map((turn) => ({
  ...turn,
  z: getPairZ(turn.pair),
  sideSign: turn.side === 'left' ? -1 : 1,
}));

const poles = roadPairs.flatMap((pair) => [
  {
    id: `pair-${pair.pair}-left`,
    pair: pair.pair,
    side: 'left',
    position: pair.leftBase,
    node: pair.leftNode,
  },
  {
    id: `pair-${pair.pair}-right`,
    pair: pair.pair,
    side: 'right',
    position: pair.rightBase,
    node: pair.rightNode,
  },
]);

const defaultPole = poles[Math.floor(poles.length / 2)];

function getTrafficCarZ(elapsedTime, car) {
  const progress = (elapsedTime * car.speed + car.offset) % 1;
  if (car.direction === 'north') {
    return TRAFFIC_FRONT - TRAFFIC_SPAN + progress * TRAFFIC_SPAN;
  }

  return TRAFFIC_FRONT - progress * TRAFFIC_SPAN;
}

function getNearestRoadPairIndex(z) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  roadPairs.forEach((pair, index) => {
    const distance = Math.abs(pair.z - z);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function getTrafficLightBoost(elapsedTime, pole) {
  let strongest = 0;

  TRAFFIC_CARS.forEach((car) => {
    const carZ = getTrafficCarZ(elapsedTime, car);
    const absoluteDistance = Math.abs(carZ - pole.position[2]);
    const localBoost = Math.max(0, 1 - absoluteDistance / TRAFFIC_LOCAL_LIGHT_RANGE);
    const forwardDistance = car.direction === 'north' ? pole.position[2] - carZ : carZ - pole.position[2];
    const anticipationBoost = forwardDistance >= 0 ? Math.max(0, 1 - forwardDistance / TRAFFIC_FORWARD_LIGHT_RANGE) : 0;
    const forwardWaveBoost = forwardDistance >= 0 ? Math.max(0, 1 - forwardDistance / TRAFFIC_FORWARD_WAVE_RANGE) : 0;
    const aheadBoost = Math.max(anticipationBoost * 1.18, forwardWaveBoost * 0.72);

    strongest = Math.max(strongest, Math.max(localBoost, aheadBoost));
  });

  return Math.min(1, strongest ** 1.55);
}

function getTurnApproachBoost(carZ, direction, turnZ) {
  const forwardDistance = direction === 'north' ? turnZ - carZ : carZ - turnZ;

  if (forwardDistance < -PAIR_STEP || forwardDistance > TURN_TRIGGER_WORLD) {
    return 0;
  }

  return 1 - Math.max(forwardDistance, 0) / TURN_TRIGGER_WORLD;
}

function getTurnActivationLevel(elapsedTime, turn) {
  let strongest = 0;

  TRAFFIC_CARS.forEach((car) => {
    const carZ = getTrafficCarZ(elapsedTime, car);
    strongest = Math.max(strongest, getTurnApproachBoost(carZ, car.direction, turn.z));
  });

  return strongest;
}

function getGraphRamp(distance, activeRadius, power = 1.6) {
  if (distance > activeRadius) {
    return 0;
  }

  const normalized = 1 - distance / (activeRadius + 1);
  return normalized ** power;
}

function getTurnLightBoost(elapsedTime, pole) {
  let strongest = 0;

  turnRoads.forEach((turn) => {
    const approachLevel = getTurnActivationLevel(elapsedTime, turn);
    if (approachLevel <= 0) {
      return;
    }

    const activeRadius = 0.9 + approachLevel * (TURN_ZONE_HALF_POSTS - 0.2);
    const postDelta = Math.abs(pole.pair - turn.pair);
    const graphBoost = getGraphRamp(postDelta, activeRadius, 2.2);
    strongest = Math.max(strongest, graphBoost * (0.26 + approachLevel * 0.86));
  });

  return strongest;
}

function getSideRoadLightBoost(elapsedTime, turn, offsetIndex) {
  const approachLevel = getTurnActivationLevel(elapsedTime, turn);
  if (approachLevel <= 0) {
    return 0;
  }

  const activeRadius = 0.7 + approachLevel * (SIDE_ROAD_LIGHT_OFFSETS.length + 0.15);
  const graphBoost = getGraphRamp(offsetIndex, activeRadius, 1.9);
  return graphBoost * (0.24 + approachLevel * 0.84);
}

function getSideRoadCenterX(turn) {
  return turn.sideSign * (MAIN_ROAD_HALF_WIDTH + SIDE_ROAD_LENGTH / 2 - SIDE_ROAD_JUNCTION_OVERLAP);
}

function getSideRoadJunctionCenterX(turn) {
  return turn.sideSign * (MAIN_ROAD_HALF_WIDTH - SIDE_ROAD_JUNCTION_PATCH / 2);
}

function getSideRoadOffsetX(turn, offset) {
  return turn.sideSign * (MAIN_ROAD_HALF_WIDTH + offset);
}

function smoothResponse(current, target, delta, brightenSpeed = 6.2, dimSpeed = 3.1) {
  const speed = target > current ? brightenSpeed : dimSpeed;
  return current + (target - current) * (1 - Math.exp(-delta * speed));
}

function NightBackdrop() {
  return (
    <group>
      <mesh position={[0, 24, -42]}>
        <sphereGeometry args={[190, 36, 36]} />
        <meshBasicMaterial color="#05111a" side={BackSide} />
      </mesh>

      <mesh position={[0, 28, -126]}>
        <circleGeometry args={[28, 64]} />
        <meshBasicMaterial color="#123a54" transparent opacity={0.12} />
      </mesh>

      <mesh position={[0, 24, -128]}>
        <planeGeometry args={[180, 84]} />
        <meshBasicMaterial color="#0a1f2d" transparent opacity={0.42} />
      </mesh>

      <mesh position={[0, 9, -118]}>
        <planeGeometry args={[150, 18]} />
        <meshBasicMaterial color="#12354a" transparent opacity={0.22} />
      </mesh>

      <mesh position={[12, 14, -96]} rotation={[0.14, -0.24, 0]}>
        <planeGeometry args={[52, 16]} />
        <meshBasicMaterial color="#123548" transparent opacity={0.14} />
      </mesh>

      <mesh position={[-14, 12, -88]} rotation={[0.08, 0.18, 0]}>
        <planeGeometry args={[42, 14]} />
        <meshBasicMaterial color="#183f57" transparent opacity={0.1} />
      </mesh>

      <mesh position={[-18, 26, -118]}>
        <circleGeometry args={[5.2, 48]} />
        <meshBasicMaterial color="#f2fbff" transparent opacity={0.15} />
      </mesh>

      <mesh position={[-18, 26, -117.5]}>
        <circleGeometry args={[10.5, 48]} />
        <meshBasicMaterial color="#7eeeff" transparent opacity={0.08} />
      </mesh>

      <mesh position={[0, 1.4, -104]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[118, 54]} />
        <meshBasicMaterial color="#0b2230" transparent opacity={0.12} />
      </mesh>

      <mesh position={[0, 0.9, -84]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[138, 38]} />
        <meshBasicMaterial color="#103144" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function RoadAtmosphere() {
  return (
    <group>
      {[-18, -50, -86].map((z, index) => (
        <mesh key={z} position={[0, 1.1 + index * 0.14, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[22 + index * 6, 9 + index * 1.8]} />
          <meshBasicMaterial color="#7ce8ff" transparent opacity={0.024 + index * 0.006} />
        </mesh>
      ))}

      {turnRoads.map((turn) => (
        <mesh key={`turn-glow-${turn.id}`} position={[getSideRoadOffsetX(turn, 3.8), 0.32, turn.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 6.5]} />
          <meshBasicMaterial color={turn.side === 'left' ? '#7ce8ff' : '#ffc36f'} transparent opacity={0.06} />
        </mesh>
      ))}

      {[-10.5, 10.5].map((x) =>
        [-24, -72].map((z, index) => (
          <mesh key={`${x}-${z}`} position={[x, 0.4 + index * 0.08, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[8.5 + index * 2, 5.8]} />
            <meshBasicMaterial color={x < 0 ? '#7ce8ff' : '#ffc36f'} transparent opacity={0.018 + index * 0.005} />
          </mesh>
        )),
      )}
    </group>
  );
}

function SideRoadLamp({ turn, x, zOffset, offsetIndex }) {
  const lampRef = useRef(null);
  const beamRef = useRef(null);
  const poolRef = useRef(null);
  const dimLevelRef = useRef(0.04);

  useFrame((state, delta) => {
    if (!lampRef.current || !beamRef.current || !poolRef.current) {
      return;
    }

    const boost = getSideRoadLightBoost(state.clock.elapsedTime, turn, offsetIndex);
    const targetDimLevel = Math.min(1, 0.06 + boost * 1.08);
    const dimLevel = smoothResponse(dimLevelRef.current, targetDimLevel, delta, 6.8, 2.4);
    dimLevelRef.current = dimLevel;
    const shimmer = 0.92 + Math.sin(state.clock.elapsedTime * 2.2 + offsetIndex + turn.pair * 0.3) * 0.08;

    lampRef.current.material.emissiveIntensity = (0.12 + dimLevel * 2.05) * shimmer;
    beamRef.current.material.opacity = (0.012 + dimLevel * 0.28) * shimmer;
    beamRef.current.material.emissiveIntensity = 0.28 + dimLevel * 2.28;
    poolRef.current.material.opacity = 0.012 + dimLevel * 0.25;
    poolRef.current.scale.setScalar(0.66 + dimLevel * 0.62);
  });

  return (
    <group position={[x, 0, turn.z + zOffset]}>
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.065, 3.6, 16]} />
        <meshStandardMaterial color="#587081" metalness={0.64} roughness={0.28} />
      </mesh>

      <mesh ref={lampRef} position={[0, 3.66, 0]} castShadow>
        <boxGeometry args={[0.42, 0.12, 0.22]} />
        <meshStandardMaterial color="#d8e5f2" emissive="#ffc36f" emissiveIntensity={0.2} />
      </mesh>

      <mesh ref={beamRef} position={[0, 1.58, 0]}>
        <cylinderGeometry args={[0.08, 0.82, 3.05, 22, 1, true]} />
        <meshStandardMaterial
          color="#ffc36f"
          emissive="#ffc36f"
          emissiveIntensity={1}
          transparent
          opacity={0.12}
          side={DoubleSide}
        />
      </mesh>

      <mesh ref={poolRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 22]} />
        <meshBasicMaterial color="#ffd39a" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

function TJunctionRoad({ turn }) {
  const centerX = getSideRoadCenterX(turn);
  const junctionX = getSideRoadJunctionCenterX(turn);
  const stopLineX = getSideRoadOffsetX(turn, 1.3);
  const glowX = getSideRoadOffsetX(turn, 3.8);
  const dashPositions = SIDE_ROAD_DASH_OFFSETS.map((offset) => getSideRoadOffsetX(turn, offset));

  return (
    <group>
      <mesh position={[centerX, 0.012, turn.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIDE_ROAD_LENGTH + 2.8, SIDE_ROAD_WIDTH + 2.4]} />
        <meshBasicMaterial color="#17252f" transparent opacity={0.44} />
      </mesh>

      <mesh position={[junctionX, 0.019, turn.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIDE_ROAD_JUNCTION_PATCH, SIDE_ROAD_WIDTH + 0.4]} />
        <meshStandardMaterial color="#131f2a" roughness={0.72} metalness={0.1} />
      </mesh>

      <mesh position={[centerX, 0.018, turn.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIDE_ROAD_LENGTH, SIDE_ROAD_WIDTH]} />
        <meshStandardMaterial color="#15222d" roughness={0.74} metalness={0.12} />
      </mesh>

      <mesh position={[centerX, 0.008, turn.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIDE_ROAD_LENGTH + 3, SIDE_ROAD_WIDTH + 3.2]} />
        <meshBasicMaterial color="#0e2431" transparent opacity={0.12} />
      </mesh>

      {[-SIDE_ROAD_WIDTH / 2 + 0.16, SIDE_ROAD_WIDTH / 2 - 0.16].map((offset) => (
        <mesh key={`${turn.id}-edge-${offset}`} position={[centerX, 0.032, turn.z + offset]}>
          <boxGeometry args={[SIDE_ROAD_LENGTH, 0.02, 0.1]} />
          <meshStandardMaterial color="#f1f7ff" emissive="#b7ecff" emissiveIntensity={0.42} />
        </mesh>
      ))}

      <mesh position={[stopLineX, 0.05, turn.z]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.16, 0.04, SIDE_ROAD_WIDTH - 0.9]} />
        <meshStandardMaterial color="#f1f7ff" emissive="#d8ebf4" emissiveIntensity={0.3} />
      </mesh>

      {dashPositions.map((x) => (
        <mesh key={`${turn.id}-dash-${x}`} position={[x, 0.05, turn.z]}>
          <boxGeometry args={[1.7, 0.04, 0.18]} />
          <meshStandardMaterial color="#ffd07e" emissive="#ffc46c" emissiveIntensity={0.92} />
        </mesh>
      ))}

      {SIDE_ROAD_LIGHT_OFFSETS.map((offset, offsetIndex) => (
        <group key={`${turn.id}-lights-${offset}`}>
          {SIDE_ROAD_LIGHT_Z_OFFSETS.map((zOffset) => (
            <SideRoadLamp
              key={`${turn.id}-${offset}-${zOffset}`}
              turn={turn}
              x={getSideRoadOffsetX(turn, offset)}
              zOffset={zOffset}
              offsetIndex={offsetIndex}
            />
          ))}
        </group>
      ))}

      <mesh position={[glowX, 0.03, turn.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 28]} />
        <meshBasicMaterial color="#7ef0ff" transparent opacity={0.03} />
      </mesh>
    </group>
  );
}

function RoadSurface() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[64, ROAD_LENGTH + 28]} />
        <meshStandardMaterial color="#061119" roughness={0.98} metalness={0.04} />
      </mesh>

      {[-1, 1].map((sign) => (
        <mesh key={`lot-strip-${sign}`} position={[sign * (MAIN_ROAD_HALF_WIDTH + SIDEWALK_WIDTH + LOT_STRIP_WIDTH / 2 - 0.3), 0.004, -38]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[LOT_STRIP_WIDTH, ROAD_LENGTH + 26]} />
          <meshStandardMaterial color="#08141b" roughness={1} metalness={0.02} />
        </mesh>
      ))}

      {[-1, 1].map((sign) => (
        <mesh key={`sidewalk-${sign}`} position={[sign * (MAIN_ROAD_HALF_WIDTH + SIDEWALK_WIDTH / 2 + 0.8), 0.018, -38]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SIDEWALK_WIDTH, ROAD_LENGTH + 18]} />
          <meshStandardMaterial color="#253640" roughness={0.94} metalness={0.04} />
        </mesh>
      ))}

      <mesh position={[0, 0.02, -38]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, ROAD_LENGTH]} />
        <meshStandardMaterial color="#131f2a" roughness={0.72} metalness={0.12} />
      </mesh>

      <mesh position={[0, 0.026, -38]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9.8, ROAD_LENGTH - 4]} />
        <meshStandardMaterial color="#182935" roughness={0.34} metalness={0.24} />
      </mesh>

      <mesh position={[-7.5, 0.015, -38]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, ROAD_LENGTH]} />
        <meshStandardMaterial color="#09141b" roughness={0.96} />
      </mesh>

      <mesh position={[7.5, 0.015, -38]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, ROAD_LENGTH]} />
        <meshStandardMaterial color="#09141b" roughness={0.96} />
      </mesh>

      <mesh position={[0, 0.005, -38]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, ROAD_LENGTH + 18]} />
        <meshBasicMaterial color="#0e2431" transparent opacity={0.12} />
      </mesh>

      <mesh position={[0, 0.028, -38]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.4, ROAD_LENGTH - 12]} />
        <meshBasicMaterial color="#9dd9ef" transparent opacity={0.05} />
      </mesh>

      {turnRoads.map((turn) => (
        <TJunctionRoad key={turn.id} turn={turn} />
      ))}

      {[-4.8, 4.8].map((x) => (
        <mesh key={`road-edge-${x}`} position={[x, 0.03, -38]}>
          <boxGeometry args={[0.1, 0.02, ROAD_LENGTH]} />
          <meshStandardMaterial color="#f1f7ff" emissive="#b7ecff" emissiveIntensity={0.55} />
        </mesh>
      ))}

      {[-6.8, 6.8].map((x) => (
        <mesh key={`curb-${x}`} position={[x, 0.09, -38]}>
          <boxGeometry args={[0.24, 0.16, ROAD_LENGTH]} />
          <meshStandardMaterial color="#1a2f3b" metalness={0.18} roughness={0.76} />
        </mesh>
      ))}

      {Array.from({ length: 17 }, (_, index) => {
        const z = 18 - index * 8.2;
        return (
          <mesh key={z} position={[0, 0.05, z]}>
            <boxGeometry args={[0.22, 0.04, 2.7]} />
            <meshStandardMaterial color="#ffd07e" emissive="#ffc46c" emissiveIntensity={1.08} />
          </mesh>
        );
      })}

      {[-6.2, 6.2].map((x) => (
        <mesh key={x} position={[x, 0.04, -38]}>
          <boxGeometry args={[0.16, 0.02, ROAD_LENGTH]} />
          <meshStandardMaterial color="#77e8ff" emissive="#77e8ff" emissiveIntensity={0.55} />
        </mesh>
      ))}

      {Array.from({ length: 15 }, (_, index) => {
        const z = 22 - index * 9.3;
        return (
          <group key={`reflector-${z}`}>
            <mesh position={[-5.6, 0.09, z]}>
              <boxGeometry args={[0.16, 0.05, 0.34]} />
              <meshStandardMaterial color="#82ecff" emissive="#82ecff" emissiveIntensity={1.2} />
            </mesh>
            <mesh position={[5.6, 0.09, z]}>
              <boxGeometry args={[0.16, 0.05, 0.34]} />
              <meshStandardMaterial color="#ffc36f" emissive="#ffc36f" emissiveIntensity={1.1} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CityBuilding({ building }) {
  return (
    <group position={[building.x, building.height / 2, building.z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[building.width, building.height, building.depth]} />
        <meshStandardMaterial color={building.baseColor} metalness={0.16} roughness={0.84} />
      </mesh>

      <mesh position={[0, -building.height * 0.18, building.depth / 2 + 0.03]}>
        <boxGeometry args={[building.width * 0.56, building.height * 0.16, 0.05]} />
        <meshStandardMaterial color={building.windowColor} emissive={building.windowColor} emissiveIntensity={0.78} />
      </mesh>

      <mesh position={[0, building.height * 0.18, -building.depth / 2 - 0.03]}>
        <boxGeometry args={[building.width * 0.42, building.height * 0.12, 0.05]} />
        <meshStandardMaterial color={building.accentColor} emissive={building.accentColor} emissiveIntensity={0.42} />
      </mesh>
    </group>
  );
}

function CityBlocks() {
  const leftBuildings = [
    { id: 'left-a', x: -17.4, z: 16, width: 6.2, height: 3.8, depth: 7.6, baseColor: '#0d2230', windowColor: '#e5f8ff', accentColor: '#8edfff' },
    { id: 'left-b', x: -15.2, z: -6, width: 5.2, height: 5.4, depth: 6.2, baseColor: '#102532', windowColor: '#dff5ff', accentColor: '#88dfff' },
    { id: 'left-c', x: -18.6, z: -34, width: 7.1, height: 3.3, depth: 8.4, baseColor: '#0e1e2a', windowColor: '#ffdba6', accentColor: '#ffc36f' },
    { id: 'left-d', x: -15.8, z: -58, width: 4.8, height: 6.1, depth: 6.6, baseColor: '#122534', windowColor: '#e8f8ff', accentColor: '#7ce8ff' },
    { id: 'left-e', x: -19.4, z: -92, width: 7.8, height: 4.2, depth: 8.8, baseColor: '#0c1c28', windowColor: '#ffdba6', accentColor: '#ffc36f' },
  ];
  const rightBuildings = [
    { id: 'right-a', x: 17.2, z: 12, width: 5.8, height: 3.5, depth: 7.2, baseColor: '#102433', windowColor: '#ffd8a0', accentColor: '#ffc36f' },
    { id: 'right-b', x: 15.6, z: -14, width: 4.6, height: 5.1, depth: 6.1, baseColor: '#0f2231', windowColor: '#e4f7ff', accentColor: '#8edfff' },
    { id: 'right-c', x: 18.8, z: -42, width: 7, height: 3.2, depth: 8.2, baseColor: '#10212d', windowColor: '#ffdca0', accentColor: '#ffc36f' },
    { id: 'right-d', x: 15.8, z: -72, width: 5.2, height: 5.8, depth: 6.4, baseColor: '#102433', windowColor: '#dff6ff', accentColor: '#7ce8ff' },
    { id: 'right-e', x: 18.4, z: -102, width: 6.4, height: 4, depth: 8.4, baseColor: '#0d2230', windowColor: '#ffdba6', accentColor: '#ffc36f' },
  ];

  return (
    <group>
      {[...leftBuildings, ...rightBuildings].map((building) => (
        <mesh key={`pad-${building.id}`} position={[building.x, 0.03, building.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[building.width + 3.2, building.depth + 2.8]} />
          <meshBasicMaterial color="#09131a" transparent opacity={0.45} />
        </mesh>
      ))}

      {leftBuildings.map((building) => (
        <CityBuilding key={building.id} building={building} />
      ))}

      {rightBuildings.map((building) => (
        <CityBuilding key={building.id} building={building} />
      ))}

      {turnRoads.map((turn) => (
        <mesh key={`corner-lot-${turn.id}`} position={[getSideRoadCenterX(turn) + turn.sideSign * 1.8, 0.025, turn.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SIDE_ROAD_LENGTH + 2.4, SIDE_ROAD_WIDTH + 5.4]} />
          <meshBasicMaterial color="#0a161e" transparent opacity={0.24} />
        </mesh>
      ))}

      {[-16, -52, -94].map((z, index) => (
        <mesh key={`light-column-${z}`} position={[0, 5.2 + index * 1.2, z]}>
          <boxGeometry args={[0.06, 9 + index * 2, 0.06]} />
          <meshBasicMaterial color="#7ce8ff" transparent opacity={0.04} />
        </mesh>
      ))}
    </group>
  );
}

function TrafficCar({ car }) {
  const carRef = useRef(null);
  const haloRef = useRef(null);
  const bodyGlowRef = useRef(null);

  useFrame((state) => {
    if (!carRef.current || !haloRef.current || !bodyGlowRef.current) {
      return;
    }

    const pulse = Math.sin(state.clock.elapsedTime * 8 + car.offset);
    const z = getTrafficCarZ(state.clock.elapsedTime, car);
    carRef.current.position.z = z;
    carRef.current.rotation.y = car.direction === 'north' ? Math.PI : 0;
    haloRef.current.material.opacity = 0.11 + pulse * 0.024;
    bodyGlowRef.current.material.opacity = 0.08 + pulse * 0.02;
  });

  return (
    <group ref={carRef} position={[car.laneX, 0.28, 0]}>
      <mesh ref={haloRef} position={[0, 0.05, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.46, 32]} />
        <meshBasicMaterial color="#ffd59a" transparent opacity={0.12} />
      </mesh>

      <mesh ref={bodyGlowRef} position={[0, 0.32, 0.08]}>
        <boxGeometry args={[1.24, 0.42, 2.82]} />
        <meshBasicMaterial color={car.color} transparent opacity={0.08} />
      </mesh>

      <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.16, 0.16, 2.46]} />
        <meshStandardMaterial color="#0c141b" metalness={0.48} roughness={0.42} />
      </mesh>

      <mesh position={[0, 0.23, 0.08]} castShadow receiveShadow>
        <boxGeometry args={[1.18, 0.38, 2.72]} />
        <meshStandardMaterial color={car.color} emissive={car.color} emissiveIntensity={0.55} metalness={0.5} roughness={0.18} />
      </mesh>

      <mesh position={[0, 0.4, -0.34]} rotation={[0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.9, 0.22, 1.12]} />
        <meshStandardMaterial color="#d7e5ef" emissive="#7fdcff" emissiveIntensity={0.38} metalness={0.28} roughness={0.12} />
      </mesh>

      <mesh position={[0, 0.52, 0.46]} rotation={[-0.14, 0, 0]} castShadow>
        <boxGeometry args={[0.72, 0.16, 1.04]} />
        <meshStandardMaterial color="#f0f7fb" emissive="#8fddff" emissiveIntensity={0.22} metalness={0.18} roughness={0.12} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={`wheel-front-${x}`} position={[x, 0.08, 0.74]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.18, 16]} />
          <meshStandardMaterial color="#0f141a" roughness={0.88} metalness={0.22} />
        </mesh>
      ))}
      {[-0.42, 0.42].map((x) => (
        <mesh key={`wheel-back-${x}`} position={[x, 0.08, -0.74]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 0.18, 16]} />
          <meshStandardMaterial color="#0f141a" roughness={0.88} metalness={0.22} />
        </mesh>
      ))}
    </group>
  );
}

function CommunicationBeacon({ onSelect }) {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef(null);
  const coreRef = useRef(null);

  useCursor(hovered);

  useFrame((state) => {
    if (!ringRef.current || !coreRef.current) {
      return;
    }

    ringRef.current.rotation.x = Math.PI / 2;
    ringRef.current.rotation.z += 0.015;
    ringRef.current.scale.setScalar(hovered ? 1.18 : 1);
    coreRef.current.scale.setScalar(hovered ? 1.14 : 1);
  });

  return (
    <group position={COMMUNICATION_BEACON}>
      <mesh
        ref={ringRef}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <torusGeometry args={[0.92, 0.05, 14, 64]} />
        <meshBasicMaterial color="#7ef0ff" transparent opacity={0.32} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshStandardMaterial color="#ffc36f" emissive="#ffc36f" emissiveIntensity={1.8} />
      </mesh>
    </group>
  );
}

function LampPost({ pole, active, onSelectFeature }) {
  const [hovered, setHovered] = useState(false);
  const nodeRef = useRef(null);
  const beamRef = useRef(null);
  const poolRef = useRef(null);
  const lampRef = useRef(null);
  const sensorRef = useRef(null);
  const sensorRingRef = useRef(null);
  const controllerRef = useRef(null);
  const cmsNodeRef = useRef(null);
  const cmsRingRef = useRef(null);
  const dimLevelRef = useRef(0.08);
  const visualBoostRef = useRef(0.08);
  const sign = pole.side === 'left' ? 1 : -1;
  const lampX = sign * 1.58;
  const lampY = 4.06;
  const nodeX = sign * 0.16;
  const sensorX = sign * 0.2;
  const cmsX = sign * -0.16;

  useCursor(hovered);

  useFrame((state, delta) => {
    if (
      !nodeRef.current ||
      !beamRef.current ||
      !poolRef.current ||
      !lampRef.current ||
      !sensorRef.current ||
      !sensorRingRef.current ||
      !controllerRef.current ||
      !cmsNodeRef.current ||
      !cmsRingRef.current
    ) {
      return;
    }

    const shimmer = 0.88 + Math.sin(state.clock.elapsedTime * 3.1 + pole.pair * 0.4) * 0.12;
    const trafficBoost = getTrafficLightBoost(state.clock.elapsedTime, pole);
    const turnBoost = getTurnLightBoost(state.clock.elapsedTime, pole);
    const reactiveBoost = Math.max(trafficBoost, turnBoost);
    const targetVisualBoost = active ? 1 : hovered ? 0.94 : reactiveBoost;
    const targetDimLevel = active ? 1 : hovered ? 0.96 : Math.min(1, 0.12 + reactiveBoost * 1.02);
    const visualBoost = smoothResponse(visualBoostRef.current, targetVisualBoost, delta, 7.4, 3.1);
    const dimLevel = smoothResponse(dimLevelRef.current, targetDimLevel, delta, 6.6, 2.6);
    visualBoostRef.current = visualBoost;
    dimLevelRef.current = dimLevel;

    nodeRef.current.scale.setScalar(0.92 + dimLevel * 0.66);
    nodeRef.current.material.emissiveIntensity = (0.36 + dimLevel * 3.25) * shimmer;
    lampRef.current.material.emissiveIntensity = 0.1 + dimLevel * 1.95;
    beamRef.current.material.opacity = (0.012 + dimLevel * 0.3) * shimmer;
    beamRef.current.material.emissiveIntensity = 0.24 + dimLevel * 2.34;
    beamRef.current.scale.set(0.72 + dimLevel * 0.3, 0.42 + dimLevel * 1.02, 0.72 + dimLevel * 0.3);
    poolRef.current.material.opacity = 0.014 + dimLevel * 0.28;
    poolRef.current.scale.setScalar(0.62 + dimLevel * 0.76);
    sensorRef.current.material.emissiveIntensity = 0.52 + visualBoost * 2.18;
    sensorRingRef.current.scale.setScalar(0.82 + visualBoost * 0.46);
    sensorRingRef.current.material.opacity = 0.07 + visualBoost * 0.3;
    controllerRef.current.material.emissiveIntensity = 0.12 + visualBoost * 1.28;
    cmsNodeRef.current.material.emissiveIntensity = 0.42 + visualBoost * 1.92;
    cmsRingRef.current.rotation.z += 0.012;
    cmsRingRef.current.scale.setScalar(0.86 + visualBoost * 0.4);
    cmsRingRef.current.material.opacity = 0.05 + visualBoost * 0.26;
  });

  return (
    <group position={pole.position}>
      <mesh position={[0, 2.25, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 4.5, 18]} />
        <meshStandardMaterial color={active ? '#6e8297' : '#4d6071'} metalness={0.72} roughness={0.26} />
      </mesh>

      <mesh position={[sign * 0.84, 4.22, 0]} rotation={[0, 0, sign * -0.14]} castShadow>
        <boxGeometry args={[1.7, 0.08, 0.08]} />
        <meshStandardMaterial color="#6f8598" metalness={0.72} roughness={0.24} />
      </mesh>

      <mesh position={[sign * 1.28, 4.12, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.2, 14]} />
        <meshStandardMaterial color="#597082" metalness={0.7} roughness={0.28} />
      </mesh>

      <mesh ref={lampRef} position={[lampX, lampY, 0]} castShadow>
        <boxGeometry args={[0.56, 0.14, 0.28]} />
        <meshStandardMaterial color="#d8e5f2" emissive="#ffc36f" emissiveIntensity={0.22} />
      </mesh>

      <mesh
        position={[lampX, lampY, 0]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature('led', pole.id);
        }}
      >
        <boxGeometry args={[1, 0.42, 0.6]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <mesh
        ref={beamRef}
        position={[lampX, 2.02, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature('adaptive', pole.id);
        }}
      >
        <cylinderGeometry args={[0.12, 1.02, 3.72, 28, 1, true]} />
        <meshStandardMaterial
          color="#ffc36f"
          emissive="#ffc36f"
          emissiveIntensity={1.1}
          transparent
          opacity={0.16}
          side={DoubleSide}
        />
      </mesh>

      <mesh ref={poolRef} position={[lampX, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.08, 26]} />
        <meshBasicMaterial color="#ffd39a" transparent opacity={0.1} />
      </mesh>

      <mesh
        ref={nodeRef}
        position={[nodeX, 3.88, 0.16]}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature('sensor', pole.id);
        }}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#7ef0ff" emissive="#7ef0ff" emissiveIntensity={1.6} />
      </mesh>

      <mesh
        ref={sensorRef}
        position={[sensorX, 3.46, 0.18]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature('sensor', pole.id);
        }}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#9bf6ff" emissive="#7ef0ff" emissiveIntensity={1.4} />
      </mesh>

      <mesh ref={sensorRingRef} position={[sensorX, 3.32, 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.18, 28]} />
        <meshBasicMaterial color="#7ef0ff" transparent opacity={0.26} side={DoubleSide} />
      </mesh>

      <mesh
        ref={controllerRef}
        position={[sign * -0.14, 2.66, 0.18]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature('controller', pole.id);
        }}
      >
        <boxGeometry args={[0.28, 0.48, 0.2]} />
        <meshStandardMaterial color="#183242" emissive="#7ef0ff" emissiveIntensity={0.5} metalness={0.5} roughness={0.24} />
      </mesh>

      <mesh
        ref={cmsNodeRef}
        position={[cmsX, 3.04, -0.12]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature('cms', pole.id);
        }}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#7ef0ff" emissive="#7ef0ff" emissiveIntensity={1.5} />
      </mesh>

      <mesh ref={cmsRingRef} position={[cmsX, 3.04, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.02, 12, 32]} />
        <meshBasicMaterial color="#7ef0ff" transparent opacity={0.22} />
      </mesh>

      <mesh
        position={[lampX, lampY, 0]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature('led', pole.id);
        }}
      >
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function NetworkHub({ pulse, onSelect }) {
  const coreRef = useRef(null);
  const ringRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  useCursor(hovered);

  useFrame((state) => {
    if (!coreRef.current || !ringRef.current) {
      return;
    }

    coreRef.current.rotation.y += 0.02;
    ringRef.current.rotation.x = 0.35 + Math.sin(state.clock.elapsedTime * 1.1) * 0.18;
    ringRef.current.rotation.z += 0.012;
    coreRef.current.material.emissiveIntensity = pulse ? 2.2 : 1.15;
  });

  return (
    <group position={HUB_POSITION}>
      <mesh
        ref={coreRef}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <icosahedronGeometry args={[0.56, 0]} />
        <meshStandardMaterial color="#9df2ff" emissive="#7ef0ff" emissiveIntensity={1.5} />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[1.18, 0.06, 16, 72]} />
        <meshBasicMaterial color="#7ef0ff" transparent opacity={0.16} />
      </mesh>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <sphereGeometry args={[1.3, 18, 18]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

function SignalPacket({ points, trigger, delay = 0, speed = 0.55, color = '#7ef0ff', size = 0.16 }) {
  const bodyRef = useRef(null);
  const glowRef = useRef(null);
  const stateRef = useRef({ trigger: -1, start: 0 });

  if (points.length < 2) {
    return null;
  }

  const curve = new CatmullRomCurve3(points.map((point) => new Vector3(...point)));

  useFrame((state) => {
    if (!bodyRef.current || !glowRef.current) {
      return;
    }

    if (stateRef.current.trigger !== trigger) {
      stateRef.current.trigger = trigger;
      stateRef.current.start = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - stateRef.current.start - delay;
    if (elapsed < 0 || elapsed > 2.2) {
      bodyRef.current.visible = false;
      glowRef.current.visible = false;
      return;
    }

    const progress = Math.min(elapsed * speed, 1);
    const position = curve.getPointAt(progress);
    const fade = progress > 0.92 ? 1 - (progress - 0.92) / 0.08 : 1;

    bodyRef.current.visible = true;
    glowRef.current.visible = true;
    bodyRef.current.position.copy(position);
    glowRef.current.position.copy(position);
    bodyRef.current.material.opacity = fade;
    glowRef.current.material.opacity = 0.18 * fade;
    glowRef.current.scale.setScalar(1.05 + Math.sin(state.clock.elapsedTime * 20) * 0.08);
  });

  return (
    <>
      <mesh ref={glowRef}>
        <sphereGeometry args={[size * 2.6, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} />
      </mesh>
      <mesh ref={bodyRef}>
        <sphereGeometry args={[size, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={1} />
      </mesh>
    </>
  );
}

function TrafficAdaptiveSignals({ overlayActive }) {
  const detectRefs = useRef([]);
  const roadRefs = useRef([]);
  const hubRefs = useRef([]);
  const glowRefs = useRef([]);

  useFrame((state) => {
    TRAFFIC_CARS.forEach((car, index) => {
      const carZ = getTrafficCarZ(state.clock.elapsedTime, car);
      const pairIndex = getNearestRoadPairIndex(carZ);
      const pair = roadPairs[pairIndex];
      const currentNode = car.laneX < 0 ? pair.leftNode : pair.rightNode;
      const nextIndex = car.direction === 'north' ? Math.max(pairIndex - 1, 0) : Math.min(pairIndex + 1, roadPairs.length - 1);
      const nextPair = roadPairs[nextIndex];
      const nextNode = car.laneX < 0 ? nextPair.leftNode : nextPair.rightNode;
      const carPoint = [car.laneX, 0.62, carZ];
      const detectorProgress = (state.clock.elapsedTime * 2.7 + car.offset) % 1;
      const roadProgress = (state.clock.elapsedTime * 1.95 + car.offset * 1.4) % 1;
      const hubProgress = (state.clock.elapsedTime * 1.25 + car.offset * 0.7) % 1;
      const turnSignal = Math.max(
        0,
        ...turnRoads.map((turn) => Math.max(0, 1 - Math.abs(turn.z - carZ) / 28) * getTurnActivationLevel(state.clock.elapsedTime, turn)),
      );
      const signalStrength = 0.18 + turnSignal * 0.82;

      const detectRef = detectRefs.current[index];
      const roadRef = roadRefs.current[index];
      const hubRef = hubRefs.current[index];
      const glowRef = glowRefs.current[index];

      if (detectRef) {
        detectRef.position.set(
          carPoint[0] + (currentNode[0] - carPoint[0]) * detectorProgress,
          carPoint[1] + (currentNode[1] - carPoint[1]) * detectorProgress,
          carPoint[2] + (currentNode[2] - carPoint[2]) * detectorProgress,
        );
        detectRef.material.opacity = overlayActive ? 0.08 + signalStrength * 0.2 : 0;
        detectRef.scale.setScalar(0.72 + signalStrength * 0.2);
      }

      if (roadRef) {
        roadRef.position.set(
          currentNode[0] + (nextNode[0] - currentNode[0]) * roadProgress,
          currentNode[1] + (nextNode[1] - currentNode[1]) * roadProgress,
          currentNode[2] + (nextNode[2] - currentNode[2]) * roadProgress,
        );
        roadRef.material.opacity = overlayActive ? 0.06 + signalStrength * 0.14 : 0;
        roadRef.scale.setScalar(0.78 + signalStrength * 0.2);
      }

      if (hubRef) {
        hubRef.position.set(
          currentNode[0] + (HUB_POSITION[0] - currentNode[0]) * hubProgress,
          currentNode[1] + (HUB_POSITION[1] - currentNode[1]) * hubProgress,
          currentNode[2] + (HUB_POSITION[2] - currentNode[2]) * hubProgress,
        );
        hubRef.material.opacity = overlayActive ? 0.05 + signalStrength * 0.12 : 0;
        hubRef.scale.setScalar(0.7 + signalStrength * 0.2);
      }

      if (glowRef) {
        glowRef.position.set(car.laneX, 0.08, carZ);
        glowRef.material.opacity = overlayActive ? 0.018 + signalStrength * 0.04 + Math.sin(state.clock.elapsedTime * 6 + index) * 0.01 : 0;
      }
    });
  });

  if (!overlayActive) {
    return null;
  }

  return (
    <group>
      {TRAFFIC_CARS.map((car, index) => (
        <group key={car.id}>
          <mesh ref={(element) => { detectRefs.current[index] = element; }}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color="#ffc36f" transparent opacity={0.12} />
          </mesh>
          <mesh ref={(element) => { roadRefs.current[index] = element; }}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshBasicMaterial color="#7ef0ff" transparent opacity={0.1} />
          </mesh>
          <mesh ref={(element) => { hubRefs.current[index] = element; }}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color="#7ef0ff" transparent opacity={0.1} />
          </mesh>
          <mesh ref={(element) => { glowRefs.current[index] = element; }} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.9, 1.18, 32]} />
            <meshBasicMaterial color={car.color} transparent opacity={0.05} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CommunicationSystem({ activePoleId, signalTick, overlayActive }) {
  if (!overlayActive || !activePoleId) {
    return null;
  }

  const activePole = poles.find((pole) => pole.id === activePoleId) ?? defaultPole;
  const leftPoints = roadPairs.map((pair) => pair.leftNode);
  const rightPoints = roadPairs.map((pair) => pair.rightNode);
  const sameSidePoints = activePole.side === 'left' ? leftPoints : rightPoints;
  const oppositeSidePoints = activePole.side === 'left' ? rightPoints : leftPoints;
  const sameIndex = activePole.pair;
  const localStart = Math.max(sameIndex - OVERLAY_PAIR_RANGE, 0);
  const localEnd = Math.min(sameIndex + OVERLAY_PAIR_RANGE, roadPairs.length - 1);
  const localPairs = roadPairs.slice(localStart, localEnd + 1);

  const activeNode = activePole.node;
  const oppositeNode = activePole.side === 'left' ? roadPairs[sameIndex].rightNode : roadPairs[sameIndex].leftNode;
  const towardsFront = sameSidePoints.slice(localStart, sameIndex + 1).reverse();
  const towardsDepth = sameSidePoints.slice(sameIndex, localEnd + 1);
  const oppositeTowardsFront = oppositeSidePoints.slice(localStart, sameIndex + 1).reverse();
  const oppositeTowardsDepth = oppositeSidePoints.slice(sameIndex, localEnd + 1);
  const hubPath = [
    activeNode,
    [activeNode[0] * 0.4, 6.2, activeNode[2] - 4.5],
    HUB_POSITION,
  ];

  return (
    <group>
      <Line points={leftPoints.slice(localStart, localEnd + 1)} color="#173547" transparent opacity={0.18} lineWidth={0.85} />
      <Line points={rightPoints.slice(localStart, localEnd + 1)} color="#173547" transparent opacity={0.18} lineWidth={0.85} />

      {localPairs.map((pair) => (
        <Line
          key={pair.pair}
          points={[pair.leftNode, pair.rightNode]}
          color={pair.pair === sameIndex ? '#7ef0ff' : '#173949'}
          transparent
          opacity={pair.pair === sameIndex ? 0.38 : 0.1}
          lineWidth={0.72}
        />
      ))}

      <Line points={hubPath} color="#143547" transparent opacity={0.16} lineWidth={0.74} />

      <SignalPacket points={[activeNode, oppositeNode]} trigger={signalTick} speed={1.05} color="#7ef0ff" size={0.14} />
      <SignalPacket points={towardsFront} trigger={signalTick} delay={0.12} speed={0.46} color="#ffc36f" size={0.12} />
      <SignalPacket points={towardsDepth} trigger={signalTick} delay={0.18} speed={0.46} color="#ffc36f" size={0.12} />
      <SignalPacket points={oppositeTowardsFront} trigger={signalTick} delay={0.36} speed={0.42} color="#7ef0ff" size={0.12} />
      <SignalPacket points={oppositeTowardsDepth} trigger={signalTick} delay={0.42} speed={0.42} color="#7ef0ff" size={0.12} />
      <SignalPacket points={hubPath} trigger={signalTick} delay={0.08} speed={0.6} color="#7ef0ff" size={0.16} />
    </group>
  );
}

function Experience({ activePoleId, signalTick, overlayActive, onSelectFeature }) {
  return (
    <>
      <color attach="background" args={['#041019']} />
      <fog attach="fog" args={['#041019', 24, 132]} />
      <ambientLight intensity={0.58} />
      <hemisphereLight color="#d0ebff" groundColor="#031018" intensity={0.92} />
      <directionalLight
        position={[15, 18, 10]}
        intensity={1.46}
        color="#ffd79e"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={96}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <directionalLight position={[-18, 10, -24]} intensity={0.26} color="#8fe7ff" />
      <spotLight position={[0, 18, 2]} angle={0.42} penumbra={0.7} intensity={0.36} color="#86e9ff" />
      <pointLight position={[0, 7, -26]} intensity={0.72} color="#7ef0ff" />
      <pointLight position={[0, 6, -78]} intensity={0.56} color="#ffc36f" />
      {turnRoads.map((turn) => (
        <pointLight
          key={`turn-light-${turn.id}`}
          position={[getSideRoadOffsetX(turn, 5.8), 3.6, turn.z]}
          intensity={0.42}
          distance={22}
          color={turn.side === 'left' ? '#7ce8ff' : '#ffc36f'}
        />
      ))}

      <Stars radius={170} depth={110} count={1200} factor={3.4} saturation={0} speed={0.16} fade />

      <NightBackdrop />
      <RoadAtmosphere />
      <RoadSurface />
      <CityBlocks />
      <NetworkHub pulse={overlayActive} onSelect={() => onSelectFeature('cms', activePoleId)} />
      <CommunicationBeacon onSelect={() => onSelectFeature('communication', activePoleId)} />
      <CommunicationSystem activePoleId={activePoleId} signalTick={signalTick} overlayActive={overlayActive} />
      <TrafficAdaptiveSignals overlayActive={overlayActive} />

      {poles.map((pole) => (
        <LampPost
          key={pole.id}
          pole={pole}
          active={pole.id === activePoleId}
          onSelectFeature={onSelectFeature}
        />
      ))}

      {TRAFFIC_CARS.map((car) => (
        <TrafficCar key={car.id} car={car} />
      ))}

      <mesh position={[0, -0.01, -38]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[84, ROAD_LENGTH + 50]} />
        <meshBasicMaterial color="#041019" transparent opacity={0.32} side={DoubleSide} />
      </mesh>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={18}
        maxDistance={64}
        minPolarAngle={0.56}
        maxPolarAngle={1.22}
        target={[0, 3.8, -34]}
      />
    </>
  );
}

function App() {
  const [activePoleId, setActivePoleId] = useState(null);
  const [signalTick, setSignalTick] = useState(1);
  const [popupState, setPopupState] = useState(null);
  const overlayActive = popupState !== null;

  const activePole = poles.find((pole) => pole.id === activePoleId) ?? defaultPole;
  const popup = popupState ? popupContent[popupState.feature] : null;

  const handleSelectFeature = (feature, poleId = activePoleId) => {
    const resolvedPoleId = poleId ?? activePoleId ?? defaultPole.id;
    setActivePoleId(resolvedPoleId);
    setPopupState({ feature, poleId: resolvedPoleId });
    setSignalTick((value) => value + 1);
  };

  return (
    <main className="experience-shell">
      <Canvas
        shadows
        dpr={[1, 1.8]}
        camera={{ position: [18, 11, 18], fov: 38 }}
        onPointerMissed={() => {
          setActivePoleId(null);
          setPopupState(null);
        }}
      >
        <Suspense fallback={null}>
          <Experience activePoleId={activePoleId} signalTick={signalTick} overlayActive={overlayActive} onSelectFeature={handleSelectFeature} />
        </Suspense>
      </Canvas>

      {popup ? (
        <aside className="popup-card" role="dialog" aria-modal="false" aria-label={popup.title}>
          <button
            type="button"
            className="popup-card__close"
            aria-label="Stäng popup"
            onClick={() => setPopupState(null)}
          >
            ×
          </button>
          <p className="popup-card__eyebrow">
            Aktiv del av systemet | Stolppar {String(activePole.pair + 1).padStart(2, '0')}
          </p>
          <h2>{popup.title}</h2>
          <p className="popup-card__text">{popup.text}</p>
          <ul className="popup-card__list">
            {popup.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <div className="popup-card__tags">
            {popup.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </aside>
      ) : null}
    </main>
  );
}

export default App;
