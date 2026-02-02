import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Switch, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from '../Constants';

const AlertsScreen = () => {
    const brand = Constants.BRAND;

    // State
    const [isEnabled, setIsEnabled] = useState(true);
    const [categories, setCategories] = useState({ 'USA Stores': [], 'UK Stores': [], 'Canada Stores': [] });
    const [loading, setLoading] = useState(true);

    // Preferences State (Mocked per session for now)
    const [selectedCountries, setSelectedCountries] = useState({ 'USA Stores': true, 'UK Stores': false, 'Canada Stores': false });
    const [selectedSubs, setSelectedSubs] = useState({});

    useEffect(() => {
        fetchSubcategories();
    }, []);

    const fetchSubcategories = async () => {
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/categories`);
            const data = await response.json();
            const cats = data.categories || {};
            setCategories(cats);

            // Initialize all subs as enabled for selected countries
            const initialSubs = {};
            Object.keys(cats).forEach(country => {
                cats[country].forEach(sub => {
                    if (sub !== 'ALL') {
                        initialSubs[sub] = true;
                    }
                });
            });
            setSelectedSubs(initialSubs);
        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleCountry = (code) => {
        setSelectedCountries(prev => ({ ...prev, [code]: !prev[code] }));
    };

    const toggleSub = (sub) => {
        setSelectedSubs(prev => ({ ...prev, [sub]: !prev[sub] }));
    };

    const renderSubcategorySection = (countryCode, label, flag) => {
        if (!selectedCountries[countryCode]) return null;

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{flag} {label} Stores</Text>
                {categories[countryCode]?.map(sub => (
                    <View key={sub} style={styles.row}>
                        <Text style={styles.label}>{sub}</Text>
                        <Switch
                            trackColor={{ false: '#767577', true: brand.BLUE }}
                            thumbColor={selectedSubs[sub] ? '#FFF' : '#f4f3f4'}
                            onValueChange={() => toggleSub(sub)}
                            value={selectedSubs[sub]}
                        />
                    </View>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Alert Settings</Text>
                <TouchableOpacity style={styles.saveBtn}>
                    <Text style={{ color: brand.BLUE, fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* MASTER TOGGLE */}
                <View style={styles.masterRow}>
                    <Text style={styles.masterLabel}>Push Notifications</Text>
                    <Switch
                        trackColor={{ false: '#767577', true: '#10B981' }}
                        thumbColor={'#FFF'}
                        onValueChange={setIsEnabled}
                        value={isEnabled}
                    />
                </View>

                {isEnabled && (
                    <>
                        <Text style={styles.description}>
                            Select which regions and stores you want to receive alerts for.
                        </Text>

                        {/* COUNTRY FILTERS */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Regions</Text>
                            <View style={styles.row}>
                                <Text style={styles.label}>🇺🇸 United States</Text>
                                <Switch value={selectedCountries['USA Stores']} onValueChange={() => toggleCountry('USA Stores')} trackColor={{ true: brand.BLUE }} />
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>🇬🇧 United Kingdom</Text>
                                <Switch value={selectedCountries['UK Stores']} onValueChange={() => toggleCountry('UK Stores')} trackColor={{ true: brand.BLUE }} />
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>🇨🇦 Canada</Text>
                                <Switch value={selectedCountries['Canada Stores']} onValueChange={() => toggleCountry('Canada Stores')} trackColor={{ true: brand.BLUE }} />
                            </View>
                        </View>

                        {/* SUBCATEGORY FILTERS */}
                        {loading ? (
                            <ActivityIndicator color={brand.BLUE} style={{ marginTop: 20 }} />
                        ) : (
                            <>
                                {renderSubcategorySection('USA Stores', 'United States', '🇺🇸')}
                                {renderSubcategorySection('UK Stores', 'United Kingdom', '🇬🇧')}
                                {renderSubcategorySection('Canada Stores', 'Canada', '🇨🇦')}
                            </>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9F6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFF' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
    saveBtn: { padding: 10 },

    scroll: { padding: 20 },

    masterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    masterLabel: { fontSize: 18, fontWeight: '700', color: '#1F2937' },

    description: { color: '#6B7280', marginBottom: 25, lineHeight: 20 },

    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#9CA3AF', marginBottom: 15, letterSpacing: 1, textTransform: 'uppercase' },

    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    label: { fontSize: 16, fontWeight: '600', color: '#374151' }
});

export default AlertsScreen;
