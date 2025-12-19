import React, { useState } from 'react';
import type { TransportBus, TransportSubscription } from '../../types';

interface BusSeatSelectorProps {
  bus: TransportBus;
  selectedSeat: string | null;
  onSeatSelect: (seatLabel: string | null) => void;
  occupiedSeats?: TransportSubscription[]; // Active subscriptions with seat assignments
  seatLayoutConfig?: { rows: number; columns: string[] };
  disabled?: boolean;
  showOccupantInfo?: boolean; // For managers to see who occupies seats
}

export default function BusSeatSelector({
  bus,
  selectedSeat,
  onSeatSelect,
  occupiedSeats = [],
  seatLayoutConfig = { rows: 10, columns: ['A', 'B', 'C', 'D'] },
  disabled = false,
  showOccupantInfo = false,
}: BusSeatSelectorProps) {
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  const { rows, columns } = seatLayoutConfig;

  const getSeatStatus = (seatLabel: string): 'available' | 'occupied' | 'selected' => {
    if (selectedSeat === seatLabel) return 'selected';
    const isOccupied = occupiedSeats.some(sub => sub.seat_label === seatLabel);
    return isOccupied ? 'occupied' : 'available';
  };

  const getOccupantInfo = (seatLabel: string): string | null => {
    const occupant = occupiedSeats.find(sub => sub.seat_label === seatLabel);
    return occupant?.student?.name || null;
  };

  const handleSeatClick = (seatLabel: string) => {
    if (disabled) return;
    
    const status = getSeatStatus(seatLabel);
    if (status === 'occupied') return; // Can't select occupied seats
    
    // Toggle selection
    if (selectedSeat === seatLabel) {
      onSeatSelect(null);
    } else {
      onSeatSelect(seatLabel);
    }
  };

  const getSeatColorClass = (status: 'available' | 'occupied' | 'selected'): string => {
    switch (status) {
      case 'available':
        return 'bg-green-100 border-green-300 hover:bg-green-200 cursor-pointer';
      case 'occupied':
        return 'bg-red-100 border-red-300 cursor-not-allowed opacity-60';
      case 'selected':
        return 'bg-blue-500 border-blue-700 text-white cursor-pointer';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg border">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Bus {bus.bus_number} - Seat Selection</h3>
        <p className="text-sm text-gray-600">Capacity: {bus.capacity} seats</p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-100 border border-green-300 rounded"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-100 border border-red-300 rounded"></div>
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-500 border border-blue-700 rounded"></div>
          <span>Selected</span>
        </div>
      </div>

      {/* Bus Layout */}
      <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-300">
        {/* Driver Section */}
        <div className="mb-4 flex items-center justify-end">
          <div className="w-16 h-12 bg-gray-300 rounded flex items-center justify-center text-xs font-semibold">
            DRIVER
          </div>
        </div>

        {/* Seats Grid */}
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, rowIndex) => {
            const rowNumber = rowIndex + 1;
            return (
              <div key={rowNumber} className="flex justify-between items-center gap-4">
                {/* Row number */}
                <div className="w-6 text-center text-xs font-semibold text-gray-500">
                  {rowNumber}
                </div>

                {/* Left side seats (columns A & B) */}
                <div className="flex gap-2">
                  {columns.slice(0, 2).map(column => {
                    const seatLabel = `${rowNumber}${column}`;
                    const status = getSeatStatus(seatLabel);
                    const occupant = getOccupantInfo(seatLabel);

                    return (
                      <div
                        key={seatLabel}
                        className={`relative w-12 h-12 rounded border-2 flex items-center justify-center text-xs font-semibold transition-all ${getSeatColorClass(status)}`}
                        onClick={() => handleSeatClick(seatLabel)}
                        onMouseEnter={() => setHoveredSeat(seatLabel)}
                        onMouseLeave={() => setHoveredSeat(null)}
                      >
                        {seatLabel}
                        
                        {/* Tooltip for occupied seats */}
                        {showOccupantInfo && occupant && hoveredSeat === seatLabel && (
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                            {occupant}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-gray-800"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Aisle */}
                <div className="w-8 flex-shrink-0"></div>

                {/* Right side seats (columns C & D) */}
                <div className="flex gap-2">
                  {columns.slice(2, 4).map(column => {
                    const seatLabel = `${rowNumber}${column}`;
                    const status = getSeatStatus(seatLabel);
                    const occupant = getOccupantInfo(seatLabel);

                    return (
                      <div
                        key={seatLabel}
                        className={`relative w-12 h-12 rounded border-2 flex items-center justify-center text-xs font-semibold transition-all ${getSeatColorClass(status)}`}
                        onClick={() => handleSeatClick(seatLabel)}
                        onMouseEnter={() => setHoveredSeat(seatLabel)}
                        onMouseLeave={() => setHoveredSeat(null)}
                      >
                        {seatLabel}
                        
                        {/* Tooltip for occupied seats */}
                        {showOccupantInfo && occupant && hoveredSeat === seatLabel && (
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                            {occupant}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-gray-800"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Row number (right side) */}
                <div className="w-6 text-center text-xs font-semibold text-gray-500">
                  {rowNumber}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back of bus label */}
        <div className="mt-4 text-center text-xs text-gray-500 font-semibold">
          BACK OF BUS
        </div>
      </div>

      {selectedSeat && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-blue-900">
            Selected Seat: {selectedSeat}
          </p>
        </div>
      )}
    </div>
  );
}
