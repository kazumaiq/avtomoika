import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import { WorkerCharacter } from './WorkerCharacter';

export function WorkersLayer() {
  const playerWorkers = useGameStore((s) => s.workers);
  // Subscribe to competitor bays so competitor worker list refreshes when competitor expands
  useGameStore((s) => s.competitor.bays);

  return (
    <group>
      {playerWorkers.map((w) => (
        <WorkerCharacter key={w.id} profile={w} />
      ))}
      {gameSimulation.competitorWorkers.map((w) => (
        <WorkerCharacter key={w.id} profile={w} />
      ))}
    </group>
  );
}
