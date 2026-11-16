import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, TextInput } from 'react-native-paper';
import { ThemeContext } from '../ThemeContext';

/** Collapsible search input for transaction/list screens. */
export default function CompactSearch({ value, onChangeText, placeholder = 'Search', accessibilityLabel = 'Search' }) {
  const { palette } = useContext(ThemeContext);
  const [expanded, setExpanded] = useState(Boolean(value));
  useEffect(() => { if (value) setExpanded(true); }, [value]);
  return (
    <View style={[styles.wrapper, expanded && styles.expandedWrapper]}>
      <IconButton
        icon={expanded ? 'close' : 'magnify'}
        size={21}
        onPress={() => {
          if (expanded) {
            onChangeText('');
            setExpanded(false);
          } else setExpanded(true);
        }}
        accessibilityLabel={expanded ? 'Close search and clear query' : accessibilityLabel}
        style={styles.icon}
        iconColor={palette.textMuted}
      />
      {expanded && (
        <TextInput
          dense
          mode="outlined"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          accessibilityLabel={accessibilityLabel}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[styles.input, { backgroundColor: palette.input }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', minWidth: 42, flexShrink: 0 },
  expandedWrapper: { flex: 1, minWidth: 0 },
  icon: { margin: 0 },
  input: { flex: 1, minWidth: 0, backgroundColor: '#fff', height: 42 },
});
