import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PlanFormData, AlternativeAction, TimeSlot } from '../types';
import {
  saveDailyPlan,
  getDailyPlan,
  updateDailyPlan,
  checkTimeConflict,
  getFormattedTodayPlan,
} from '../config/firebase';
import Text from '../components/ui/Text';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import MyModule from '../../modules/my-module';
import { 
  getLogicalToday, 
  stopRemindersAfterPlanSet,
  startAppStateMonitoring
} from '../utils/notifications';

const ALTERNATIVE_ACTIONS: AlternativeAction[] = ['Turn off display', 'Go back', 'Home button'];

const formatTime = (date: Date): string => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const isValidEndTime = (endTime: string): boolean => {
  const [hours, minutes] = endTime.split(':').map(Number);
  return hours <= 5 || (hours === 5 && minutes <= 59);
};

const validateTimeFormat = (time: string): boolean => {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};

type Props = {
  isModifyMode?: boolean;
  onPlanSaved?: () => void;
  allowModify?: boolean;
};

export default function PlanScreen({ onPlanSaved }: Props) {
  const [plans, setPlans] = useState<PlanFormData[]>([]);
  const [currentForm, setCurrentForm] = useState<PlanFormData>({
    startTime: '',
    endTime: '',
    activity: '',
    alternativeAction: 'Turn off display',
  });
  const [existingPlans, setExistingPlans] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [editStartPicker, setEditStartPicker] = useState(false);
  const [editEndPicker, setEditEndPicker] = useState(false);
  const [isPlanSaved, setIsPlanSaved] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanFormData | null>(null);
  const [originalPlans, setOriginalPlans] = useState<PlanFormData[]>([]);
  const [hasExistingData, setHasExistingData] = useState(false);

  const today = getLogicalToday();

  useEffect(() => {
    loadExistingPlans();
    const cleanup = startAppStateMonitoring();
    return cleanup;
  }, []);

  const loadExistingPlans = async () => {
    try {
      const todayPlan = await getDailyPlan(today);
      if (todayPlan && todayPlan.timeSlots && todayPlan.timeSlots.length > 0) {
        const formattedPlans = todayPlan.timeSlots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          activity: slot.activity,
          alternativeAction: slot.alternativeAction || 'Turn off display'
        }));
        
        setPlans(formattedPlans);
        setOriginalPlans(JSON.parse(JSON.stringify(formattedPlans)));
        setExistingPlans(todayPlan.timeSlots);
        setHasExistingData(true);
      }
    } catch (error) {
      console.error('Error loading existing plans:', error);
      Alert.alert('Error', 'An error occurred while loading plans.');
    }
  };

  const hasChanges = useCallback((): boolean => {
    if (!hasExistingData) return plans.length > 0;
    if (plans.length !== originalPlans.length) return true;
    
    return plans.some((plan, index) => {
      const original = originalPlans[index];
      return JSON.stringify(plan) !== JSON.stringify(original);
    });
  }, [plans, originalPlans, hasExistingData]);

  const checkOvernightPlan = (startTime: string, endTime: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (startTime <= endTime) {
        resolve(true);
        return;
      }

      if (!isValidEndTime(endTime)) {
        Alert.alert('Error', 'Next day plans can only be set until 5:59 AM.');
        resolve(false);
        return;
      }

      Alert.alert(
        'Next Day Plan Confirmation',
        `Do you want to set a plan from ${startTime} to ${endTime} the next day?`,
        [
          { text: 'Cancel', onPress: () => resolve(false) },
          { text: 'Confirm', onPress: () => resolve(true) }
        ]
      );
    });
  };

  const validatePlan = async (plan: PlanFormData, excludeIndex?: number): Promise<boolean> => {
    if (!plan.startTime || !plan.endTime || !plan.activity.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return false;
    }

    if (!validateTimeFormat(plan.startTime) || !validateTimeFormat(plan.endTime)) {
      Alert.alert('Error', 'Invalid time format. (e.g., 09:30)');
      return false;
    }

    if (plan.startTime === plan.endTime) {
      Alert.alert('Error', 'End time cannot be the same as start time.');
      return false;
    }

    const isOvernightConfirmed = await checkOvernightPlan(plan.startTime, plan.endTime);
    if (!isOvernightConfirmed) return false;

    const otherPlans = plans.filter((_, index) => index !== excludeIndex);
    const hasConflict = otherPlans.some(otherPlan => {
      if (plan.startTime > plan.endTime || otherPlan.startTime > otherPlan.endTime) {
        return false;
      }
      
      const newStart = new Date(`2000-01-01T${plan.startTime}:00`);
      const newEnd = new Date(`2000-01-01T${plan.endTime}:00`);
      const existingStart = new Date(`2000-01-01T${otherPlan.startTime}:00`);
      const existingEnd = new Date(`2000-01-01T${otherPlan.endTime}:00`);
      
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (hasConflict) {
      Alert.alert('Error', 'Time conflicts with other plans.');
      return false;
    }

    if (!hasExistingData && checkTimeConflict(plan, existingPlans)) {
      Alert.alert('Error', 'Time conflicts with already planned time slots.');
      return false;
    }

    return true;
  };

  const addPlan = async () => {
    const isValid = await validatePlan(currentForm);
    if (!isValid) return;

    setPlans(prev => [...prev, { ...currentForm }]);
    setCurrentForm({
      startTime: '',
      endTime: '',
      activity: '',
      alternativeAction: 'Turn off display',
    });
  };

  const removePlan = (index: number) => {
    setPlans(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingPlan(null);
    }
  };

  const startEditPlan = (index: number) => {
    setEditingIndex(index);
    setEditingPlan({ ...plans[index] });
  };

  const saveEditPlan = async () => {
    if (editingIndex === null || !editingPlan) return;

    const isValid = await validatePlan(editingPlan, editingIndex);
    if (!isValid) return;

    setPlans(prev => prev.map((plan, i) => i === editingIndex ? editingPlan : plan));
    setEditingIndex(null);
    setEditingPlan(null);
  };

  const cancelEditPlan = () => {
    setEditingIndex(null);
    setEditingPlan(null);
  };

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (editingIndex !== null) {
          Alert.alert(
            'Cancel Edit',
            'Do you want to cancel editing the plan?',
            [
              { text: 'Continue Editing', style: 'cancel' },
              { text: 'Cancel', onPress: cancelEditPlan }
            ]
          );
          return true;
        }
        
        if (hasChanges()) {
          Alert.alert(
            'Save Changes',
            'You have unsaved changes. Do you want to exit?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() }
            ]
          );
          return true;
        }
        
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [editingIndex, hasChanges, cancelEditPlan])
  );

  const createOvernightPlans = (plan: PlanFormData) => {
    if (plan.startTime <= plan.endTime) return [plan];

    return [
      { ...plan, endTime: '23:59' },
      { ...plan, startTime: '00:00' }
    ];
  };

  const savePlans = async () => {
    if (plans.length === 0) {
      Alert.alert('Error', 'Please add at least one plan.');
      return;
    }

    if (hasExistingData && !hasChanges()) {
      Alert.alert('No Changes', 'There are no changes to the plan.');
      return;
    }

    const handleSave = async () => {
      if (loading) return; // 중복 실행 방지
      setLoading(true);
      try {
        const expandedPlans = plans.flatMap(createOvernightPlans);
        const todayPlans = expandedPlans.filter(plan =>
          plan.startTime <= plan.endTime || plan.endTime === '23:59'
        );
        const tomorrowPlans = expandedPlans.filter(plan =>
          plan.startTime === '00:00' && plan.endTime !== '23:59'
        );
  
        if (hasExistingData) {
          await updateDailyPlan(todayPlans, today, originalPlans);
          if (tomorrowPlans.length > 0) {
            const tomorrow = new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000);
            await updateDailyPlan(tomorrowPlans, tomorrow.toISOString().split('T')[0], originalPlans);
          }
          Alert.alert('Success', 'Plan has been updated.');
        } else {
          await saveDailyPlan(todayPlans, today);
          if (tomorrowPlans.length > 0) {
            const tomorrow = new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000);
            await saveDailyPlan(tomorrowPlans, tomorrow.toISOString().split('T')[0]);
          }
          Alert.alert('Success', 'Today\'s plan has been saved.');
        }
  
        setIsPlanSaved(true);
        try {
          const slots = await getFormattedTodayPlan();
          if (slots) await MyModule.cacheTodayPlan(slots);
        } catch (error) {
          console.error('Error passing plan to native module:', error);
        }
  
        await stopRemindersAfterPlanSet();
        onPlanSaved?.();
      } catch (error) {
        console.error('Error saving plan:', error);
        Alert.alert('Error', 'An error occurred while saving the plan.');
      } finally {
        setLoading(false);
      }
    };
  
    if (!hasExistingData) {
      Alert.alert('Save Plan', 'Do you want to save?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: handleSave }
      ]);
    } else {
      handleSave();
    }
  };

  const renderTimePicker = (
    isVisible: boolean,
    onClose: () => void,
    onTimeChange: (time: string) => void
  ) => (
    isVisible && (
      <RNDateTimePicker
        mode="time"
        value={new Date()}
        onChange={(event, selectedDate) => {
          onClose();
          if (selectedDate) onTimeChange(formatTime(selectedDate));
        }}
        display="spinner"
      />
    )
  );

  const renderAlternativeActionSelector = (
    plan: PlanFormData,
    onUpdate: (plan: PlanFormData) => void
  ) => (
    <View style={styles.alternativeContainer}>
      <Text style={styles.inputLabel}>Alternative Activity</Text>
      <View style={styles.radioContainer}>
        {ALTERNATIVE_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action}
            style={styles.radioOption}
            onPress={() => onUpdate({ ...plan, alternativeAction: action })}
            activeOpacity={0.7}
          >
            <View style={[
              styles.radioCircle,
              plan.alternativeAction === action && styles.radioCircleSelected
            ]}>
              {plan.alternativeAction === action && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioLabel}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTimeInputs = (
    plan: PlanFormData,
    onUpdate: (plan: PlanFormData) => void,
    isEditing = false
  ) => (
    <View style={styles.timeInputContainer}>
      <Text style={styles.inputLabel}>Time</Text>
      <View style={styles.timeInputRow}>
        <TouchableOpacity
          style={styles.timeButton}
          onPress={() => isEditing ? setEditStartPicker(true) : setShowStartPicker(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.timeButtonText}>
            {plan.startTime || 'Start Time'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.timeSeparator}>~</Text>
        <TouchableOpacity
          style={styles.timeButton}
          onPress={() => isEditing ? setEditEndPicker(true) : setShowEndPicker(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.timeButtonText}>
            {plan.endTime || 'End Time'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {renderTimePicker(
        isEditing ? editStartPicker : showStartPicker,
        () => isEditing ? setEditStartPicker(false) : setShowStartPicker(false),
        (time) => onUpdate({ ...plan, startTime: time })
      )}
      
      {renderTimePicker(
        isEditing ? editEndPicker : showEndPicker,
        () => isEditing ? setEditEndPicker(false) : setShowEndPicker(false),
        (time) => onUpdate({ ...plan, endTime: time })
      )}
    </View>
  );

  const renderPlanItem = (plan: PlanFormData, index: number) => {
    const isEditing = editingIndex === index;
    const currentPlan = isEditing ? editingPlan! : plan;

    return (
      <View key={index} style={styles.planItem}>
        {isEditing ? (
          <View style={styles.editForm}>
            {renderTimeInputs(currentPlan, setEditingPlan, true)}
            
            <View style={styles.activityInputContainer}>
              <Text style={styles.inputLabel}>Activity</Text>
              <TextInput
                style={styles.activityInput}
                value={currentPlan.activity}
                onChangeText={(text) => setEditingPlan({ ...currentPlan, activity: text })}
                placeholder="Enter activity details"
                multiline
                placeholderTextColor="#A1A1AA"
              />
            </View>

            {renderAlternativeActionSelector(currentPlan, setEditingPlan)}

            <View style={styles.editButtonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEditPlan}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveEditButton} onPress={saveEditPlan}>
                <Text style={styles.saveEditButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.planContent}>
            <View style={styles.planHeader}>
              <View style={styles.timeChip}>
                <Text style={styles.planTime}>{plan.startTime} ~ {plan.endTime}</Text>
              </View>
              <View style={styles.planActions}>
                <TouchableOpacity style={styles.editButton} onPress={() => startEditPlan(index)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeButton} onPress={() => removePlan(index)}>
                  <Text style={styles.removeButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.planActivity}>{plan.activity}</Text>
            <View style={styles.altActionChip}>
              <Text style={styles.planAltAction}>Alternative: {plan.alternativeAction}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (isPlanSaved) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Today's Plan</Text>
          <Text style={styles.headerSubtitle}>Check your saved plan</Text>
        </View>
        
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>My Plans ({plans.length})</Text>
          {plans.map(renderPlanItem)}
        </ScrollView>

        <TouchableOpacity
          style={styles.modifyButton}
          onPress={() => setIsPlanSaved(false)}
        >
          <Text style={styles.modifyButtonText}>Modify Plan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {hasExistingData ? 'Modify Plan' : 'Create Today\'s Plan'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {hasExistingData ? 'You can modify existing plans' : 'Design your perfect day'}
        </Text>
        {hasExistingData && hasChanges() && (
          <Text style={styles.unsavedText}>You have unsaved changes</Text>
        )}
      </View>
      
      <ScrollView style={styles.content}>
        {plans.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              {hasExistingData ? 'Current Plans' : 'Added Plans'} ({plans.length})
            </Text>
            {plans.map(renderPlanItem)}
          </View>
        )}

        {editingIndex === null && (
          
          <View style={styles.addSection}>
            <Text style={styles.sectionTitle}>Add New Plan</Text>
            
            {renderTimeInputs(currentForm, setCurrentForm)}
            
            <View style={styles.activityInputContainer}>
              <Text style={styles.inputLabel}>Activity</Text>
              <TextInput
                value={currentForm.activity}
                onChangeText={(text) => setCurrentForm(prev => ({ ...prev, activity: text }))}
                placeholder="e.g., Read 3 chapters of EMNLP paper"
                multiline
                style={styles.activityInput}
                placeholderTextColor="#A1A1AA"
              />
            </View>

            {renderAlternativeActionSelector(currentForm, setCurrentForm)}

            <TouchableOpacity style={styles.addButton} onPress={addPlan}>
              <Text style={styles.addButtonText}>Add Plan</Text>
            </TouchableOpacity>
          </View>
        )}
            <TouchableOpacity
        style={[styles.saveButton, { opacity: plans.length === 0 || loading ? 0.5 : 1 }]}
        onPress={savePlans}
        disabled={plans.length === 0 || loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'Saving...' : hasExistingData ? 'Save Changes' : 'Save Plan'}
        </Text>
      </TouchableOpacity>
      </ScrollView>

  
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    marginTop: 29,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '400',
  },
  unsavedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#EF4444',
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 24,
    marginBottom: 16,
  },
  planItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  planContent: {
    padding: 20,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  planTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  removeButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  planActivity: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 12,
  },
  altActionChip: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  planAltAction: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  editForm: {
    padding: 20,
  },
  timeInputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#475569',
  },
  timeSeparator: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activityInputContainer: {
    marginBottom: 20,
  },
  activityInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  alternativeContainer: {
    marginBottom: 24,
  },
  radioContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioCircleSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF4FF',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  editButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveEditButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveEditButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginTop: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    margin: 24,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modifyButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    margin: 24,
  },
  modifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
