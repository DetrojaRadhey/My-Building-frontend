import React, { useState } from 'react';
import { Colors } from '../constants/colors';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Building } from '../hooks/useBuildings';

type Props = {
  buildings: Building[];
  loading: boolean;
  selected: Building | null;
  onSelect: (b: Building) => void;
  label?: string;
};

export default function BuildingDropdown({ buildings, loading, selected, onSelect, label = 'Select Building *' }: Props) {
  const [open, setOpen] = useState(false);
  

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <>
            <Text style={[styles.triggerText, !selected && styles.placeholder]}>
              {selected ? selected.name : 'Tap to select a building...'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
          </>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select Building</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={buildings}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, selected?.id === item.id && styles.optionSelected]}
                onPress={() => { onSelect(item); setOpen(false); }}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.optionIcon}>🏢</Text>
                  <View>
                    <Text style={[styles.optionName, selected?.id === item.id && styles.optionNameSelected]}>
                      {item.name}
                    </Text>
                    {item.address && <Text style={styles.optionAddr}>{item.address}</Text>}
                  </View>
                </View>
                {selected?.id === item.id && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No buildings found. Create one first.</Text>
            }
            contentContainerStyle={{ padding: 16 }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, padding: 12, backgroundColor: Colors.primary + '08' },
  triggerText: { fontSize: 15, color: Colors.text, fontWeight: '600', flex: 1 },
  placeholder: { color: Colors.textMuted, fontWeight: '400' },
  sheet: { flex: 1, backgroundColor: Colors.white },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 28, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: Colors.bg },
  optionSelected: { backgroundColor: Colors.primary + '15', borderWidth: 1.5, borderColor: Colors.primary },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  optionIcon: { fontSize: 24 },
  optionName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  optionNameSelected: { color: Colors.primary },
  optionAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 15 },
});
