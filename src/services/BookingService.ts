import { supabase } from '../supabaseClient';

export interface BookingRequest {
  customerName: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes?: string;
}

export const BookingService = {
  
  // 1. DURATION RULES: Calculate time based on covers
  calculateDuration(covers: number): number {
    if (covers <= 2) return 90; // 1.5 hours
    if (covers <= 4) return 105; // 1.75 hours
    if (covers <= 6) return 120; // 2 hours
    if (covers <= 10) return 150; // 2.5 hours
    return 180; // Large groups logic
  },

  // 2. PACING LOGIC (Flow Control): Check if kitchen limit is reached
  async checkPacing(date: string, time: string, newCovers: number): Promise<boolean> {
    const { data: intervalSettings } = await supabase
      .from('booking_settings')
      .select('max_covers_per_interval')
      .single();
      
    const LIMIT = intervalSettings?.max_covers_per_interval || 20;

    // Count existing covers for this specific time slot
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_time', `${date}T${time}:00`) // Simplified match
      .neq('status', 'CANCELLED');

    return (count || 0) + newCovers <= LIMIT;
  },

  // 3. THE "TETRIS" EFFECT: Find an available table without breaking slots
  async findOptimalTable(date: string, time: string, duration: number, partySize: number): Promise<string | null> {
    const startTime = new Date(`${date}T${time}:00`);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Get ALL tables that fit the party size
    const { data: tables } = await supabase
      .from('dining_tables')
      .select('*')
      .gte('max_covers', partySize) // Must fit party
      .lte('min_covers', partySize + 2) // Don't put 2 people on a 10-top (efficiency)
      .order('max_covers', { ascending: true }); // Smallest fit first

    if (!tables) return null;

    for (const table of tables) {
      // Check for overlapping bookings on this specific table
      const { data: conflicts } = await supabase
        .from('bookings')
        .select('id')
        .eq('table_id', table.id)
        .or(`booking_time.lte.${endTime.toISOString()},expected_end_time.gte.${startTime.toISOString()}`);
      
      // If no conflict, this is our "Tetris" match!
      if (!conflicts || conflicts.length === 0) {
        return table.id;
      }
    }

    return null; // No single table found -> triggers Waitlist or Table Joining logic
  },

  // 4. MAIN BOOKING FUNCTION
  async createBooking(req: BookingRequest) {
    // A. Check Flow Control First
    const pacingOk = await this.checkPacing(req.date, req.time, req.partySize);
    if (!pacingOk) throw new Error("Kitchen capacity reached for this time slot. Try +15 mins.");

    // B. Calculate Duration
    const duration = this.calculateDuration(req.partySize);

    // C. Find Table (Grid Logic)
    const tableId = await this.findOptimalTable(req.date, req.time, duration, req.partySize);
    
    if (!tableId) {
       // D. Waitlist Logic would go here
       throw new Error("No tables available. Join Waitlist?");
    }

    // E. Insert Booking
    const { error } = await supabase.from('bookings').insert({
      customer_name: req.customerName,
      booking_time: `${req.date}T${req.time}:00`,
      duration_minutes: duration,
      party_size: req.partySize,
      table_id: tableId,
      status: 'CONFIRMED'
    });

    if (error) throw error;
    return { success: true, tableId, duration };
  }
};
