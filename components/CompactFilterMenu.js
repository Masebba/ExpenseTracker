import React, { useContext, useState } from 'react';
import { Button, Menu } from 'react-native-paper';
import { ThemeContext } from '../ThemeContext';

/** A compact single-select filter that keeps long category lists out of the page layout. */
export default function CompactFilterMenu({ value, options = [], onChange, label = 'Filter', disabled = false }) {
  const { palette } = useContext(ThemeContext);
  const [visible, setVisible] = useState(false);
  const safeOptions = Array.isArray(options) ? options : [];
  const selected = safeOptions.find((item) => item.value === value);
  const fullLabel = String(selected?.label || 'Choose a filter');
  const rawDisplayLabel = String(selected?.shortLabel || selected?.label || 'Choose');
  // Keep category names readable without letting unusually long labels push
  // the search field or primary action off narrow phone screens.
  const displayLabel = rawDisplayLabel.length > 16
    ? `${rawDisplayLabel.slice(0, 15).trimEnd()}…`
    : rawDisplayLabel;

  return (
    <Menu
      contentStyle={{ backgroundColor: palette.surface }}
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={(
        <Button
          compact
          icon="filter-variant"
          mode="outlined"
          textColor={palette.text}
          disabled={disabled}
          onPress={() => setVisible(true)}
          accessibilityLabel={`${label}: ${fullLabel}`}
          style={{ borderRadius: 20, flexShrink: 1, borderColor: palette.border }}
          contentStyle={{ minHeight: 36 }}
        >
          {displayLabel}
        </Button>
      )}
    >
      {safeOptions.map((item) => (
        <Menu.Item
          key={String(item.value)}
          title={item.label}
          titleStyle={{ color: palette.text }}
          leadingIcon={item.value === value ? 'check' : undefined}
          onPress={() => { setVisible(false); if (item.value !== value) onChange(item.value); }}
        />
      ))}
    </Menu>
  );
}
