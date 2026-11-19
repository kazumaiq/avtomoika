import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import { VehicleModel } from './VehicleModel';

export function VehiclesLayer() {
  // Re-renders only when cars spawn or leave; per-frame movement runs in VehicleModel useFrame
  useGameStore((s) => s.entityVersion);

  return (
    <group>
      {gameSimulation.vehicles.map((v) => (
        <VehicleModel key={v.id} vehicleId={v.id} initial={v} />
      ))}
    </group>
  );
}
