import { supabase } from './supabase';

export interface Caregiver {
  id: string;
  email: string | null;
  displayName: string | null;
  isOwner: boolean;
  entryCount?: number;
  lastActivityAt?: string | null;
}

export interface CaregiverStats {
  entryCount: number;
  lastActivityAt: string | null;
}

interface CaregiverResult<T> {
  data: T | null;
  error: string | null;
}

export const CaregiverService = {
  async getCurrentUserId(): Promise<string | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return data.user.id;
  },

  async getCaregiverDisplayName(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.display_name || data.email || null;
  },

  async getHouseholdCaregivers(
    householdId: string
  ): Promise<CaregiverResult<Caregiver[]>> {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, is_owner')
      .eq('household_id', householdId);

    if (error) {
      return { data: null, error: 'fetchFailed' };
    }

    const caregivers: Caregiver[] = (data || []).map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      isOwner: user.is_owner ?? false,
    }));

    return { data: caregivers, error: null };
  },

  async getCaregiverStats(
    caregiverId: string,
    householdId: string
  ): Promise<CaregiverResult<CaregiverStats>> {
    const { data, error } = await supabase.rpc('get_caregiver_stats', {
      caregiver_id: caregiverId,
      household_id: householdId,
    });

    if (error) {
      return { data: null, error: 'fetchStatsFailed' };
    }

    return {
      data: {
        entryCount: data?.entry_count ?? 0,
        lastActivityAt: data?.last_activity ?? null,
      },
      error: null,
    };
  },

  async removeCaregiver(
    caregiverId: string,
    householdId: string
  ): Promise<CaregiverResult<boolean>> {
    const { data, error } = await supabase.rpc('remove_caregiver', {
      caregiver_id: caregiverId,
      household_id: householdId,
    });

    if (error) {
      if (error.message?.includes('owner') || error.code === '42501') {
        return { data: null, error: 'notAuthorized' };
      }
      if (error.message?.includes('yourself') || error.code === 'SELF_REMOVAL') {
        return { data: null, error: 'cannotRemoveSelf' };
      }
      return { data: null, error: 'removeFailed' };
    }

    return { data: true, error: null };
  },

  async isHouseholdOwner(
    userId: string,
    householdId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('users')
      .select('is_owner')
      .eq('id', userId)
      .eq('household_id', householdId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.is_owner ?? false;
  },

  async getCaregiversWithStats(
    householdId: string
  ): Promise<CaregiverResult<Caregiver[]>> {
    const caregiversResult = await this.getHouseholdCaregivers(householdId);
    if (caregiversResult.error || !caregiversResult.data) {
      return caregiversResult;
    }

    const caregiversWithStats = await Promise.all(
      caregiversResult.data.map(async (caregiver) => {
        const statsResult = await this.getCaregiverStats(caregiver.id, householdId);
        return {
          ...caregiver,
          entryCount: statsResult.data?.entryCount ?? 0,
          lastActivityAt: statsResult.data?.lastActivityAt ?? null,
        };
      })
    );

    return { data: caregiversWithStats, error: null };
  },
};
