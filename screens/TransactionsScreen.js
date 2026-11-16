import React, { useContext, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { Button, Card, Text, Title, TextInput } from "react-native-paper";
import { TransactionsContext } from "../TransactionsContext";
import { CurrencyContext } from "../CurrencyContext";
import {
  currencyFromCode,
  formatMoney,
  inPeriod,
  contentWidthStyle,
} from "../utils/appUtils";
import { SafeAreaView } from "react-native-safe-area-context";
import CompactFilterMenu from "../components/CompactFilterMenu";
import CompactSearch from "../components/CompactSearch";
import { ThemeContext } from "../ThemeContext";

const filters = ["daily", "weekly", "monthly", "all"];

export default function TransactionsScreen({ navigation }) {
  const { transactions, clearTransactions } = useContext(TransactionsContext);
  const { currency } = useContext(CurrencyContext);
  const { palette, isDark } = useContext(ThemeContext);
  const [filter, setFilter] = useState("daily");
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      transactions
        .filter(
          (item) =>
            (filter === "all" || inPeriod(item.timestamp, filter)) &&
            `${item.description || ""} ${item.category || ""} ${item.type || ""} ${item.amount || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [transactions, filter, query],
  );

  const confirmClear = () =>
    Alert.alert(
      "Clear transactions?",
      "This permanently deletes the manually recorded transactions in the current workspace. Trade-linked income must be removed by deleting the related sale in Trade. Financial ledgers are currently stored on this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear all", style: "destructive", onPress: async () => {
          try { await clearTransactions(); }
          catch (error) { Alert.alert("Could not clear transactions", error?.message || "Some transactions could not be cleared. Linked Trade income must be removed by deleting its sale."); }
        } },
      ],
    );

  const renderItem = ({ item }) => {
    const positive = item.type === "income";
    return (
      <Card style={[styles.card, { backgroundColor: palette.surface }]}>{/* theme-aware transaction card */}
        <Card.Content style={styles.item}>
          <View
            style={[
              styles.typeIcon,
              { backgroundColor: palette.surfaceAlt },
            ]}
          >
            <Text
              style={{ color: positive ? palette.income : palette.expense, fontSize: 18 }}
            >
              {positive ? "↙" : "↗"}
            </Text>
          </View>
          <View style={styles.details}>
            <Text style={[styles.description, { color: palette.text }]} >
              {item.description ||
                item.category ||
                (positive ? "Income" : "Expense")}
            </Text>
            <Text style={[styles.meta, { color: palette.textMuted }]} >
              {item.category || "Uncategorized"} · {new Date(item.timestamp).toLocaleString()}
            </Text>
            {item.baseAmount !== undefined && item.baseCurrencyCode && item.baseCurrencyCode !== (item.currencyCode || item.currency) && (
              <Text style={[styles.conversionMeta, { color: palette.textMuted }]} >
                Recorded reporting value: {formatMoney(item.baseAmount, currencyFromCode(item.baseCurrencyCode))}
                {Number.isFinite(Number(item.exchangeRate)) ? ` · Rate ${Number(item.exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 8 })}` : ''}
                {item.exchangeRateTimestamp ? ` · ${new Date(item.exchangeRateTimestamp).toLocaleString()}` : ''}
              </Text>
            )}
          </View>
          <Text
            style={[styles.amount, { color: positive ? palette.income : palette.expense }]}
          >
            {positive ? "+" : "−"}
            {formatMoney(
              item.amount,
              currencyFromCode(item.currencyCode || item.currency, currency),
            )}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.safeArea, { backgroundColor: palette.header }]}>
      <View style={[styles.container, { backgroundColor: palette.background }]} >
        <View style={[styles.header, { backgroundColor: palette.header, borderBottomColor: palette.border }]} >
          <Title style={[styles.title, { color: palette.headerText }]}>Transactions</Title>
          <Button
            compact
            textColor={palette.danger}
            onPress={confirmClear}
            disabled={!transactions.length}
          >
            Clear
          </Button>
        </View>
        <View style={styles.toolbar}>
          <CompactFilterMenu value={filter} onChange={setFilter} label="Period" options={[
            { value: "daily", label: "Today" },
            { value: "weekly", label: "This week" },
            { value: "monthly", label: "This month" },
            { value: "all", label: "All time" },
          ]} />
          <CompactSearch value={query} onChangeText={setQuery} placeholder="Description, category or amount" accessibilityLabel="Search transactions" />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            filtered.length ? styles.list : styles.emptyContainer
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: palette.text }]} >{transactions.length ? 'No matching transactions' : 'Your transaction ledger is ready'}</Text>
              <Text style={[styles.empty, { color: palette.textMuted }]} >{transactions.length ? 'Try another period or adjust your search.' : 'Record money received or spent here. Other business records, including products, customers, suppliers and invoices, are available from Home.'}</Text>
              {!transactions.length && <View style={styles.emptyActions}><Button mode="contained" onPress={() => navigation.navigate('Home', { screen: 'Income' })}>Record income</Button><Button mode="outlined" onPress={() => navigation.navigate('Home', { screen: 'Expense' })}>Record expense</Button></View>}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#267F4D" },
  container: {
    flex: 1,
    ...contentWidthStyle,
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 20,
    backgroundColor: "#f4f6f3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: -18,
    paddingHorizontal: 18,
    height: 56,
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 12,
    backgroundColor: "#267F4D",
  },
  title: { fontSize: 22, color: "#ffffff" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  list: { paddingBottom: 16 },
  card: {
    marginVertical: 5,
    borderRadius: 15,
    backgroundColor: "#fff",
    elevation: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  details: { flex: 1 },
  description: { color: "#2c4031", fontWeight: "700", fontSize: 13 },
  meta: { color: "#79847b", fontSize: 10, marginTop: 4 },
  amount: { fontWeight: "700", fontSize: 12, marginLeft: 5 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  empty: { color: "#78837a", textAlign: "center", paddingHorizontal: 18, paddingVertical: 10, lineHeight: 20 },
  emptyState: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 10 },
  emptyTitle: { color: "#24432b", fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 8 },
  conversionMeta: { color: "#68776c", fontSize: 10, lineHeight: 15, marginTop: 4, paddingRight: 4 },
});
