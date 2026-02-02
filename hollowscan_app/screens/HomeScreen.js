import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    StatusBar,
    Modal,
    ActivityIndicator,
    TextInput,
    Linking,
    Animated,
    PanResponder
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from '../Constants';
import { SavedContext } from '../context/SavedContext';
import LiveProductService from '../services/LiveProductService';
import { setupNotificationHandler, sendDealNotification } from '../services/PushNotificationService';

const { width, height } = Dimensions.get('window');

const getRelativeTime = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
};

const HomeScreen = ({ isDarkMode }) => {
    const navigation = useNavigation();

    // CONFIG
    const LIMIT = 10;
    const USER_ID = '8923304e-657e-4e7e-800a-94e7248ecf7f';

    // REGIONS - Use full region names
    const regions = [
        { id: 'USA Stores', label: 'USA', flag: '🇺🇸' },
        { id: 'UK Stores', label: 'UK', flag: '🇬🇧' },
        { id: 'Canada Stores', label: 'CA', flag: '🇨🇦' }
    ];

    // STATE
    const [selectedRegion, setSelectedRegion] = useState('USA Stores');
    const [selectedSub, setSelectedSub] = useState('ALL');
    const [selectedCategories, setSelectedCategories] = useState(['ALL']); // Multiple selection
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isFilterVisible, setFilterVisible] = useState(false);

    const [dynamicCategories, setDynamicCategories] = useState({});
    const [alerts, setAlerts] = useState([]);
    const [quota, setQuota] = useState({ used: 0, limit: 4 });

    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [totalAvailable, setTotalAvailable] = useState(0);

    // BRAND
    const brand = Constants.BRAND;
    const colors = isDarkMode ? {
        bg: brand.DARK_BG,
        card: '#161618',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        accent: brand.BLUE,
        tabInactive: '#1C1C1E',
        border: 'rgba(255,255,255,0.08)',
        input: '#1C1C1E',
        badgeBg: 'rgba(45, 130, 255, 0.15)'
    } : {
        bg: brand.LIGHT_BG,
        card: '#FFFFFF',
        text: '#1C1C1E',
        textSecondary: '#636366',
        accent: brand.BLUE,
        tabInactive: '#FFFFFF',
        border: 'rgba(0,0,0,0.05)',
        input: '#FFFFFF',
        badgeBg: '#E0F2FE'
    };

    // INITIAL FETCH
    useEffect(() => {
        fetchInitialData();
    }, [selectedRegion, selectedCategories]);

    const isFirstRender = useRef(true);

    // HANDLERS
    const handleSearch = async (query = searchQuery) => {
        if (!query || !query.trim()) return;
        setIsSearching(true);
        await fetchAlerts(0, true, query);
        setIsSearching(false);
    };

    const clearSearch = () => {
        setSearchQuery('');
        fetchAlerts(0, true, '');
    };

    // SETUP NOTIFICATIONS & LIVE UPDATES
    useEffect(() => {
        console.log('[HOME] Setting up notifications and live updates');

        // Setup notification handler
        setupNotificationHandler();

        // Reset product time when region/category changes
        LiveProductService.resetLastProductTime();

        // Start polling for new products
        LiveProductService.startPolling({
            userId: USER_ID,
            country: selectedRegion,
            category: selectedCategories.includes('ALL') ? 'ALL' : selectedCategories[0],
            onlyNew: true,
            search: searchQuery,
        });

        // Subscribe to new products
        const unsubscribe = LiveProductService.subscribe((newProducts) => {
            console.log('[HOME] Received', newProducts.length, 'new products');

            // Add new products to the TOP of the list
            setAlerts(prev => {
                const existingIds = new Set(prev.map(a => a.id));
                const uniqueNew = newProducts.filter(p => !existingIds.has(p.id));
                const combined = [...uniqueNew, ...prev];

                // If not premium, strictly enforce 4 items limit in feed
                if (!isPremium) {
                    return combined.slice(0, 4);
                }
                return combined;
            });

            // Send notification for each new product
            newProducts.forEach(product => {
                sendDealNotification(product);
            });
        });

        // Cleanup
        return () => {
            console.log('[HOME] Cleaning up live updates');
            unsubscribe();
            LiveProductService.stopPolling();
        };
    }, [selectedRegion, selectedCategories, searchQuery]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        setOffset(0);
        setHasMore(true);

        await Promise.all([
            fetchCategories(),
            fetchUserStatus(),
            fetchAlerts(0, true)
        ]);

        setIsLoading(false);
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/categories`);
            const data = await response.json();
            console.log('[CATEGORIES] Fetched data:', data);

            // API returns { "categories": { "USA Stores": [...], "UK Stores": [...], "Canada Stores": [...] } }
            setDynamicCategories(data.categories || {});
        } catch (e) {
            console.log("Cat Err:", e);
            // Set some defaults if fetch fails
            setDynamicCategories({
                'USA Stores': [],
                'UK Stores': [],
                'Canada Stores': []
            });
        }
    };

    const fetchUserStatus = async () => {
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/user/status?user_id=${USER_ID}`);
            const data = await response.json();
            setQuota({ used: data.views_used, limit: data.views_limit });
            if (data.is_premium !== undefined) setIsPremium(data.is_premium);
        } catch (e) { console.log("Quota Err:", e); }
    };

    const fetchAlerts = async (currentOffset, reset = false, overrideSearch = null) => {
        try {
            const activeSearch = overrideSearch !== null ? overrideSearch : searchQuery;
            // If 'ALL' is selected, send empty string; otherwise send first selected category
            const catParam = selectedCategories.includes('ALL') ? 'ALL' : selectedCategories[0] || 'ALL';
            let url = `${Constants.API_BASE_URL}/v1/feed?user_id=${USER_ID}&region=${encodeURIComponent(selectedRegion)}&category=${encodeURIComponent(catParam)}&offset=${currentOffset}&limit=${LIMIT}`;

            if (activeSearch && activeSearch.trim()) {
                url += `&search=${encodeURIComponent(activeSearch.trim())}`;
            }

            console.log('[FETCH] Offset:', currentOffset, 'Limit:', LIMIT, 'Reset:', reset);

            const response = await fetch(url);
            if (!response.ok) throw new Error('Fetch failed');

            const result = await response.json();
            // Support both array response and new object response { products, next_offset }
            const data = Array.isArray(result) ? result : (result.products || []);
            const nextOffset = result.next_offset !== undefined ? result.next_offset : (currentOffset + LIMIT);

            // New metadata for paywall
            if (result.is_premium !== undefined) setIsPremium(result.is_premium);
            if (result.total_count !== undefined) setTotalAvailable(result.total_count);

            console.log('[FETCH] Received items:', data.length, 'Next Offset:', nextOffset);

            if (data.length >= 0) {
                if (reset) {
                    setAlerts(data);
                    setOffset(0);
                } else {
                    // Filter out duplicates in case they were prepended by live service
                    setAlerts(prev => {
                        const existingIds = new Set(prev.map(a => a.id));
                        const newItems = data.filter(item => !existingIds.has(item.id));
                        return [...prev, ...newItems];
                    });
                }

                // Update the current offset from the API response
                setOffset(nextOffset);

                // If the API says there's more or we got at least one item, keep going
                // (More robust: if we got exactly 0, and nextOffset > offset, we might still have more)
                setHasMore(data.length === LIMIT || (result.has_more !== undefined ? result.has_more : data.length > 0));
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.log("Alert Fetch Err:", e);
            setHasMore(false);
        }
    };

    const handleLoadMore = () => {
        if (!hasMore || isLoadingMore || isLoading || alerts.length === 0) {
            return;
        }

        // Strictly stop loading more for free users at 4 items
        if (!isPremium && alerts.length >= 4) {
            console.log('[HOME] Free user reached limit, blocking fetch');
            return;
        }

        console.log('[HOME] handleLoadMore triggered. Current offset:', offset);
        setIsLoadingMore(true);

        fetchAlerts(offset, false, searchQuery).then(() => {
            setIsLoadingMore(false);
        }).catch(() => setIsLoadingMore(false));
    };

    const onRefresh = async () => {
        setIsRefreshing(true);
        await fetchInitialData();
        setIsRefreshing(false);
    };

    // Get subcategories for the selected region from the new format
    const currentSubcategories = [
        'ALL',
        ...(dynamicCategories[selectedRegion] || [])
    ];

    // Log available categories when they change
    useEffect(() => {
        console.log('[CATEGORIES] Available for', selectedRegion, ':', currentSubcategories);
    }, [currentSubcategories, selectedRegion]);

    const { toggleSave, isSaved } = useContext(SavedContext);

    // ... (existing helper functions like getRelativeTime) ...

    const renderProductCard = ({ item }) => {
        if (!item) return null;
        const data = item.product_data || {};
        const catName = (item.category_name || "PROMO").toUpperCase();

        // Robust numeric validation for Resale and ROI to avoid $NaN
        const resaleVal = parseFloat(String(data.resell || '0').replace(/[^0-9.]/g, ''));
        const priceVal = parseFloat(String(data.price || '0').replace(/[^0-9.]/g, ''));

        const hasResell = !isNaN(resaleVal) && resaleVal > 0;
        const hasRoi = data.roi && data.roi !== '0' && !isNaN(parseFloat(data.roi));
        const saved = isSaved(item.id);

        return (
            <TouchableOpacity
                style={[styles.card, { borderColor: colors.border }]}
                onPress={() => navigation.navigate('ProductDetail', { product: item })}
                activeOpacity={0.9}
            >
                {/* GRADIENT OVERLAY ON CARD */}
                {isDarkMode && <View style={styles.cardGradientOverlay} />}

                <View style={styles.imageContainer}>
                    <Image source={{ uri: data.image || 'https://via.placeholder.com/400' }} style={styles.productImage} />

                    {/* PREMIUM BADGE & HEART */}
                    <View style={styles.imageOverlay}>
                        {hasRoi ? (
                            <LinearGradient
                                colors={[brand.BLUE, brand.PURPLE]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.badge}
                            >
                                <Text style={styles.badgeEmoji}>📈</Text>
                                <Text style={styles.badgeText}>{data.roi}% ROI</Text>
                            </LinearGradient>
                        ) : null}

                        <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); toggleSave(item); }}
                            style={styles.heartBtn}
                        >
                            <Text style={{ fontSize: 20 }}>{saved ? '❤️' : '🤍'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* NEW BADGE */}
                    {!item.is_locked && (
                        <View style={styles.newBadge}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFF' }}>NEW</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.cardContent, { backgroundColor: colors.card }]}>
                    {/* TITLE & CATEGORY */}
                    <View style={styles.titleRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                                {data.title || 'HollowScan Product'}
                            </Text>
                        </View>
                        <LinearGradient
                            colors={[brand.BLUE + '20', brand.PURPLE + '20']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.categoryBadge}
                        >
                            <Text style={[styles.category, { color: brand.BLUE }]}>{catName}</Text>
                        </LinearGradient>
                    </View>

                    {/* PRICE SECTION */}
                    <View style={styles.priceSection}>
                        <View style={styles.priceBlock}>
                            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>RETAIL</Text>
                            <Text style={[styles.priceValue, { color: colors.text }]}>
                                ${priceVal || '0'}
                            </Text>
                        </View>

                        {hasResell && (
                            <>
                                <View style={[styles.priceDivider, { backgroundColor: colors.border }]} />
                                <View style={styles.priceBlock}>
                                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>RESALE</Text>
                                    <Text style={[styles.priceValue, { color: brand.PURPLE, fontWeight: '900' }]}>
                                        ${resaleVal}
                                    </Text>
                                </View>

                                {hasResell && priceVal > 0 && (
                                    <>
                                        <View style={[styles.priceDivider, { backgroundColor: colors.border }]} />
                                        <View style={styles.priceBlock}>
                                            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>PROFIT</Text>
                                            <Text style={[styles.priceValue, { color: '#10B981', fontWeight: '900' }]}>
                                                ${Math.round(resaleVal - priceVal)}
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </>
                        )}
                    </View>

                    {/* FOOTER */}
                    <View style={styles.footerRow}>
                        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                            {getRelativeTime(item.created_at)}
                        </Text>
                        <Text style={{ color: brand.BLUE, fontWeight: '700', fontSize: 13 }}>
                            View details ›
                        </Text>
                    </View>
                </View>

                {/* LOCK OVERLAY */}
                {item.is_locked && (
                    <BlurView intensity={70} tint={isDarkMode ? 'dark' : 'light'} style={styles.lockOverlay}>
                        <View style={styles.lockContent}>
                            <View style={[styles.lockCircle, { backgroundColor: isDarkMode ? '#333' : '#F0F0F0' }]}>
                                <Text style={{ fontSize: 32 }}>🔒</Text>
                            </View>
                            <Text style={[styles.lockTitle, { color: colors.text }]}>Premium Deal</Text>
                            <Text style={[styles.lockDescription, { color: colors.textSecondary }]}>
                                Unlock with subscription
                            </Text>
                            <TouchableOpacity style={[styles.subscribeBtn, { backgroundColor: brand.BLUE }]}>
                                <Text style={styles.subscribeBtnText}>UPGRADE</Text>
                            </TouchableOpacity>
                        </View>
                    </BlurView>
                )}
            </TouchableOpacity>
        );
    };

    // MEMOIZED HEADER TO PREVENT FOCUS LOSS
    const listHeader = React.useMemo(() => (
        <View style={styles.header}>
            {isDarkMode ? (
                <View style={styles.gradientBg} />
            ) : (
                <LinearGradient
                    colors={['#F8F9FE', '#F0F4FF', '#F8F9FE']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBg}
                />
            )}

            <View style={styles.topBar}>
                <View style={styles.logoAndTitle}>
                    <LinearGradient
                        colors={[brand.BLUE, brand.PURPLE]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.logoBtn, styles.logoBtnGradient]}
                    >
                        <Text style={{ fontSize: 20 }}>⌖</Text>
                    </LinearGradient>
                    <View style={styles.titleContainer}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Hollowscan</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Deal Hunter</Text>
                    </View>
                </View>

                <LinearGradient
                    colors={[brand.PURPLE + '25', brand.BLUE + '15']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.quotaBadge]}
                >
                    <Text style={{ fontSize: 12, marginRight: 6 }}>⚡</Text>
                    <Text style={[styles.quotaText, { color: brand.PURPLE }]}>{quota.limit - quota.used}/{quota.limit}</Text>
                </LinearGradient>
            </View>

            <LinearGradient
                colors={isDarkMode ? ['#1C1C1E', '#2A2A2E'] : ['#FFFFFF', '#F5F7FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.searchContainer, { borderColor: isSearching ? brand.PURPLE : colors.border }]}
            >
                {isSearching ? (
                    <ActivityIndicator size="small" color={brand.PURPLE} style={{ marginRight: 10 }} />
                ) : (
                    <Text style={{ fontSize: 16, color: colors.textSecondary, marginRight: 10 }}>🔍</Text>
                )}
                <TextInput
                    placeholder="Search products..."
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.searchInput, { color: colors.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => handleSearch()}
                    returnKeyType="search"
                />
                {searchQuery.trim() !== '' && !isSearching && (
                    <TouchableOpacity onPress={clearSearch} style={{ padding: 5 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>✕</Text>
                    </TouchableOpacity>
                )}
                {!isSearching && (
                    <TouchableOpacity
                        onPress={() => handleSearch()}
                        disabled={!searchQuery.trim()}
                        style={{ marginLeft: 10, opacity: searchQuery.trim() ? 1 : 0.4 }}
                    >
                        <Text style={{ fontSize: 14, color: brand.BLUE, fontWeight: '700' }}>Search</Text>
                    </TouchableOpacity>
                )}
            </LinearGradient>

            {searchQuery.trim() !== '' && (
                <View style={styles.searchStatusRow}>
                    <View style={[styles.searchTag, { backgroundColor: brand.PURPLE + '15' }]}>
                        <Text style={[styles.searchTagText, { color: brand.PURPLE }]}>
                            {isSearching ? 'Deep scanning...' : `Results for "${searchQuery}"`}
                        </Text>
                    </View>
                    {!isSearching && (
                        <Text style={[styles.searchCount, { color: colors.textSecondary }]}>
                            {alerts.length} found
                        </Text>
                    )}
                </View>
            )}

            <View style={styles.regionSelectorContainer}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>REGIONS</Text>
                <View style={styles.regionSelector}>
                    {regions.map(r => (
                        <TouchableOpacity
                            key={r.id}
                            onPress={() => setSelectedRegion(r.id)}
                            activeOpacity={0.8}
                        >
                            {selectedRegion === r.id ? (
                                <LinearGradient
                                    colors={[brand.BLUE, brand.PURPLE]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.regionBtnActive}
                                >
                                    <Text style={{ fontSize: 28, marginBottom: 4 }}>{r.flag}</Text>
                                    <Text style={[styles.regionBtnLabel, { color: '#FFF', fontWeight: '900' }]}>{r.label}</Text>
                                </LinearGradient>
                            ) : (
                                <View style={[styles.regionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Text style={{ fontSize: 28, marginBottom: 4 }}>{r.flag}</Text>
                                    <Text style={[styles.regionBtnLabel, { color: colors.textSecondary }]}>{r.label}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity
                onPress={() => setFilterVisible(true)}
                activeOpacity={0.75}
                style={{ marginBottom: 5 }}
            >
                <LinearGradient
                    colors={[colors.card, isDarkMode ? '#1C1C1E' : '#F5F7FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.catSelector, { borderColor: colors.border, borderWidth: 1 }]}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 4 }]}>CATEGORY</Text>
                        <Text style={[styles.catSelectorText, { color: colors.text }]}>
                            {selectedCategories.includes('ALL')
                                ? '📁 All Categories'
                                : selectedCategories.length === 1
                                    ? `📍 ${selectedCategories[0]}`
                                    : `📍 ${selectedCategories.length} Selected`}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 16, color: brand.PURPLE }}>›</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    ), [isDarkMode, searchQuery, selectedRegion, selectedCategories, quota, isSearching, alerts.length, handleSearch, clearSearch]);

    return (
        <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

            <FlatList
                data={alerts}
                keyExtractor={item => String(item.id)}
                renderItem={renderProductCard}
                contentContainerStyle={styles.feedScroll}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={listHeader}
                onRefresh={onRefresh}
                refreshing={isRefreshing}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.1}
                ListFooterComponent={() => {
                    if (isLoadingMore) return <ActivityIndicator color={brand.BLUE} style={{ marginVertical: 20 }} />;

                    if (!isPremium && alerts.length >= 4) {
                        return (
                            <View style={styles.paywallContainer}>
                                <LinearGradient
                                    colors={['transparent', colors.card, colors.card]}
                                    style={styles.paywallGradient}
                                />
                                <View style={[styles.paywallContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={styles.paywallIcon}>
                                        <Text style={{ fontSize: 40 }}>💎</Text>
                                    </View>
                                    <Text style={[styles.paywallTitle, { color: colors.text }]}>Unlock {totalAvailable}+ More Deals</Text>
                                    <Text style={[styles.paywallDesc, { color: colors.textSecondary }]}>
                                        You've reached your daily free limit. Subscribe to access hundreds of high-profit leads across UK, US and Canada.
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.paywallBtn, { backgroundColor: brand.BLUE }]}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={[brand.BLUE, brand.PURPLE]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.paywallBtnGradient}
                                        >
                                            <Text style={styles.paywallBtnText}>GO PREMIUM</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                    <Text style={[styles.paywallHint, { color: colors.textSecondary }]}>
                                        Join 500+ successful resellers today
                                    </Text>
                                </View>
                            </View>
                        );
                    }
                    return <View style={{ height: 40 }} />;
                }}
                ListEmptyComponent={!isLoading ? (
                    <View style={styles.emptyContainer}>
                        <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>
                            {searchQuery ? 'No products match your search.' : `No live alerts found for this region.${'\n'}Try pulling to refresh.`}
                        </Text>
                    </View>
                ) : null}
            />

            <Modal visible={isFilterVisible} animationType="fade" transparent={true}>
                <BlurView intensity={90} style={styles.modalOverlay}>
                    <View style={styles.modalCenter}>
                        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Categories</Text>
                                <TouchableOpacity onPress={() => setFilterVisible(false)} style={styles.closeBtn}>
                                    <Text style={{ fontSize: 20, color: colors.textSecondary }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />
                            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                <TouchableOpacity
                                    onPress={() => setSelectedCategories(['ALL'])}
                                    style={[
                                        styles.categoryOption,
                                        selectedCategories.includes('ALL') && styles.categoryOptionActive,
                                        selectedCategories.includes('ALL') && { backgroundColor: brand.BLUE + '15' }
                                    ]}
                                >
                                    <Text style={{ fontSize: 16, marginRight: 10 }}>📁</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.categoryOptionText, { color: colors.text }]}>All Categories</Text>
                                        <Text style={[styles.categoryOptionSub, { color: colors.textSecondary }]}>Show all available deals</Text>
                                    </View>
                                    <View style={[styles.checkbox, selectedCategories.includes('ALL') && { backgroundColor: brand.BLUE, borderColor: brand.BLUE }]}>
                                        {selectedCategories.includes('ALL') && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
                                    </View>
                                </TouchableOpacity>
                                {currentSubcategories.filter(s => s !== 'ALL').map((sub) => (
                                    <TouchableOpacity
                                        key={sub}
                                        onPress={() => {
                                            setSelectedCategories(prev => {
                                                if (prev.includes('ALL')) return [sub];
                                                if (prev.includes(sub)) {
                                                    const updated = prev.filter(c => c !== sub);
                                                    return updated.length === 0 ? ['ALL'] : updated;
                                                }
                                                return [...prev, sub];
                                            });
                                        }}
                                        style={[
                                            styles.categoryOption,
                                            selectedCategories.includes(sub) && styles.categoryOptionActive,
                                            selectedCategories.includes(sub) && { backgroundColor: brand.PURPLE + '15' }
                                        ]}
                                    >
                                        <Text style={{ fontSize: 16, marginRight: 10 }}>📍</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.categoryOptionText, { color: colors.text }]}>{sub}</Text>
                                            <Text style={[styles.categoryOptionSub, { color: colors.textSecondary }]}>{selectedRegion} • Category</Text>
                                        </View>
                                        <View style={[styles.checkbox, selectedCategories.includes(sub) && { backgroundColor: brand.PURPLE, borderColor: brand.PURPLE }]}>
                                            {selectedCategories.includes(sub) && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                                <TouchableOpacity onPress={() => setFilterVisible(false)} style={[styles.modalBtn, { backgroundColor: colors.tabInactive, flex: 1 }]}>
                                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFilterVisible(false)} style={[styles.modalBtn, { backgroundColor: brand.BLUE, flex: 1, marginLeft: 12 }]}>
                                    <Text style={[styles.modalBtnText, { color: '#FFF', fontWeight: '900' }]}>Apply</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </BlurView>
            </Modal>

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={brand.BLUE} />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    // HEADER STYLES
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, position: 'relative' },
    gradientBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 320,
        zIndex: -1,
        backgroundColor: 'rgba(45, 130, 255, 0.02)'
    },

    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    logoAndTitle: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    logoBtn: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    logoBtnGradient: { shadowColor: '#2D82FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    titleContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },

    quotaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 20,
        shadowColor: '#9B4DFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3
    },
    quotaText: { fontWeight: '800', fontSize: 13 },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 50,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2
    },
    searchInput: { flex: 1, fontSize: 15, fontWeight: '600' },

    searchStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 4
    },
    searchTag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    searchTagText: {
        fontSize: 12,
        fontWeight: '800'
    },
    searchCount: {
        fontSize: 12,
        fontWeight: '700',
        opacity: 0.8
    },

    regionSelectorContainer: { marginBottom: 20 },
    sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
    regionSelector: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    regionBtn: {
        flex: 1,
        height: 90,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        aspectRatio: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    regionBtnActive: {
        flex: 1,
        height: 90,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        aspectRatio: 1,
        shadowColor: '#2D82FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5
    },
    regionBtnLabel: { fontSize: 12, fontWeight: '800', marginTop: 6 },

    catSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 70,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    catSelectorText: { fontSize: 15, fontWeight: '800' },

    // FEED STYLES
    feedScroll: { paddingBottom: 30 },

    card: {
        marginHorizontal: 16,
        borderRadius: 24,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
        backgroundColor: '#FFFFFF'
    },
    cardGradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        zIndex: 1,
        pointerEvents: 'none'
    },

    imageContainer: { width: '100%', height: 220, backgroundColor: '#F5F5F5', position: 'relative' },
    productImage: { width: '100%', height: '100%', resizeMode: 'contain' },
    imageOverlay: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        zIndex: 2
    },

    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        shadowColor: '#2D82FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    badgeEmoji: { fontSize: 14, marginRight: 4 },
    badgeText: { color: '#FFF', fontWeight: '900', fontSize: 12 },

    newBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        backgroundColor: '#10B981',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2,
        zIndex: 2
    },

    heartBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },

    cardContent: {
        padding: 20,
        backgroundColor: '#FFFFFF'
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
        gap: 10
    },
    title: { fontSize: 16, fontWeight: '800', flex: 1, lineHeight: 22 },
    categoryBadge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    category: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

    priceSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(45, 130, 255, 0.03)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10
    },
    priceBlock: { justifyContent: 'center', flex: 1 },
    priceLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
    priceValue: { fontSize: 18, fontWeight: '900' },
    priceDivider: { width: 1, height: 35, marginHorizontal: 14, opacity: 0.15 },

    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.06)'
    },
    timestamp: { fontSize: 12, fontWeight: '500' },

    lockOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 24
    },
    lockContent: { alignItems: 'center', padding: 25 },
    lockCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    lockTitle: { fontSize: 24, fontWeight: '900', marginBottom: 8 },
    lockDescription: { fontSize: 13, marginBottom: 20, textAlign: 'center' },
    subscribeBtn: {
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#2D82FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    subscribeBtnText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

    // MODAL STYLES
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    modalCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16
    },
    modalContent: {
        borderRadius: 28,
        maxHeight: '70%',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 16
    },
    modalTitle: { fontSize: 22, fontWeight: '900', flex: 1 },
    closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    modalDivider: { height: 1, marginHorizontal: 20, opacity: 0.1 },
    modalScroll: { maxHeight: 400 },

    categoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)'
    },
    categoryOptionActive: {
        borderLeftWidth: 4,
        borderLeftColor: 'rgba(45, 130, 255, 0.5)',
        paddingLeft: 12
    },
    categoryOptionText: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
    categoryOptionSub: { fontSize: 12, fontWeight: '500' },

    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#CCCCCC',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        marginLeft: 12
    },

    modalFooter: {
        borderTopWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        gap: 10
    },
    modalBtn: {
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2
    },
    modalBtnText: { fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
    modalCancelBtn: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalCancelText: { fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

    // PAYWALL
    paywallContainer: {
        marginTop: -100, // Pull it up to overlap the end of the feed
        paddingHorizontal: 16,
        paddingBottom: 40,
        zIndex: 10
    },
    paywallGradient: {
        height: 150,
        width: '100%',
        zIndex: -1
    },
    paywallContent: {
        borderRadius: 30,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5
    },
    paywallIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(45, 130, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    paywallTitle: {
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5
    },
    paywallDesc: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 10
    },
    paywallBtn: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16
    },
    paywallBtnGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    paywallBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1
    },
    paywallHint: {
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.8
    },
    // OTHER
    emptyContainer: { flex: 1, marginTop: 100, paddingHorizontal: 40, justifyContent: 'center', alignItems: 'center' },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)'
    }
});

export default HomeScreen;
