import React, { useContext, useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, Linking, Share, Dimensions, StatusBar } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SavedContext } from '../context/SavedContext';
import Constants from '../Constants';

const { width } = Dimensions.get('window');

const ProductDetailScreen = ({ route, navigation }) => {
    const [product, setProduct] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [copiedLabel, setCopiedLabel] = useState(null);
    const { toggleSave, isSaved } = useContext(SavedContext);

    // Handle both direct navigation and deep link
    React.useEffect(() => {
        if (route.params?.product) {
            // Direct navigation from app
            setProduct(route.params.product);
        } else if (route.params?.productId) {
            // Deep link navigation
            const productId = route.params.productId;
            // Fetch product by ID from backend
            // For now, we'll try to find it in HomeScreen's data or fetch from API
            console.log('[DEEPLINK] Loading product:', productId);
            // You may need to implement a function to fetch product by ID
        }
    }, [route.params]);

    if (!product) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Loading product...</Text>
            </View>
        );
    }

    const data = product.product_data || {};
    const saved = isSaved(product.id);
    const isDarkMode = false; // Assuming light mode for now based on screenshot
    const brand = Constants.BRAND;

    // Calculate Fees & Profit
    const buyPrice = parseFloat(data.price || '0');
    const sellPrice = parseFloat(data.resell || '0');

    // Default fees ~15% if not specified
    const feePercent = 15;
    const fees = (sellPrice * feePercent) / 100;
    const netProfit = sellPrice - buyPrice - fees;
    const roi = buyPrice > 0 ? ((netProfit / buyPrice) * 100).toFixed(0) : 0;

    const formattedProfit = netProfit.toFixed(2);
    const profitColor = netProfit > 0 ? '#10B981' : '#EF4444';

    const handleShare = async () => {
        try {
            // Create deep link for the product
            const deepLink = `hollowscan://product/${product.id}`;

            // Create share message with deep link
            const message = `🔥 Check out this deal from ${brand}!\n\n📦 ${data.title}\n💵 Buy: $${data.price}\n💰 Sell: $${data.resell}\n📈 Profit: $${formattedProfit} (ROI: ${roi}%)\n\nOpen in app: ${deepLink}`;

            await Share.share({
                message: message,
                url: deepLink,
                title: `${brand} Deal - ${data.title}`
            });
        } catch (error) {
            console.log(error);
        }
    };


    const LinkRow = ({ icon, label, url }) => (
        <TouchableOpacity
            style={styles.linkRow}
            onPress={() => url && Linking.openURL(url)}
            activeOpacity={0.7}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={{ marginRight: 10, fontSize: 16 }}>{icon}</Text>
                <Text style={styles.linkText}>{label}</Text>
            </View>
            <Text style={{ color: brand.BLUE, fontSize: 16, fontWeight: '700' }}>›</Text>
        </TouchableOpacity>
    );

    // Dynamic categorized links or default fallbacks
    const links = data.links || { buy: [], ebay: [], fba: [], other: [] };

    const ebayLink = links.ebay?.[0]?.url || `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(data.title)}&_sacat=0&LH_Sold=1&LH_Complete=1`;
    const amazonLink = links.fba?.[0]?.url || `https://www.amazon.com/s?k=${encodeURIComponent(data.title)}`;
    const googleLink = `https://www.google.com/search?q=${encodeURIComponent(data.title)}`;

    const copyToClipboard = async (text, label) => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        setCopiedLabel(label);
        setTimeout(() => setCopiedLabel(null), 2000);
    };

    const isCopyable = (label) => {
        const lowerLabel = (label || '').toLowerCase();
        return ['pid', 'sku', 'barcode', 'id', 'ean', 'upc', 'asin'].some(k => lowerLabel.includes(k));
    };

    // Helper to render price with strikethrough
    const renderPriceValue = (value) => {
        if (!value) return null;

        // Check for discount pattern: "~~15~~ 10" or "£15 (30%) £10"
        if (value.includes('~~')) {
            const parts = value.split('~~');
            // parts[0] is before, parts[1] is stuck through, parts[2] is after
            return (
                <Text>
                    {parts[0]}
                    <Text style={{ textDecorationLine: 'line-through', opacity: 0.6 }}>{parts[1]}</Text>
                    {parts[2]}
                </Text>
            );
        }

        if (value.includes('(') && value.includes(')')) {
            // Handle "£15 (30%) £10" -> "£15" (strike) "(30%) £10"
            const match = value.match(/([£$\d.]+)\s*(\(.*\))\s*([£$\d.]+)/);
            if (match) {
                return (
                    <Text>
                        <Text style={{ textDecorationLine: 'line-through', opacity: 0.6 }}>{match[1]}</Text>
                        <Text> {match[2]} </Text>
                        <Text style={{ fontWeight: '900', color: '#10B981' }}>{match[3]}</Text>
                    </Text>
                );
            }
        }

        return <Text>{value}</Text>;
    };

    // Filter out redundant fields that are already in the top card
    const visibleDetails = data.details ? data.details.filter(d => !d.is_redundant) : [];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {copiedLabel && (
                <View style={styles.copiedToast}>
                    <Text style={styles.copiedToastText}>Copied {copiedLabel} To Clipboard!</Text>
                </View>
            )}
            {/* MODERN HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.headerBtn, { backgroundColor: brand.BLUE + '15' }]}
                >
                    <Text style={{ fontSize: 18, color: brand.BLUE }}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Deal Details</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        onPress={handleShare}
                        style={[styles.headerBtn, { backgroundColor: brand.PURPLE + '15' }]}
                    >
                        <Text style={{ fontSize: 18 }}>↗</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => toggleSave(product)}
                        style={[styles.headerBtn, { backgroundColor: saved ? '#EF4444' : '#E5E5E5' }]}
                    >
                        <Text style={{ fontSize: 18 }}>{saved ? '❤️' : '🤍'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* HERO IMAGE WITH GRADIENT */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: data.image || 'https://via.placeholder.com/400' }}
                        style={styles.image}
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0, 0, 0, 0.3)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.imageGradient}
                    />
                </View>

                {/* TITLE SECTION */}
                <View style={styles.section}>
                    <Text style={styles.title}>{data.title}</Text>
                    <View style={styles.tagsRow}>
                        <LinearGradient
                            colors={[brand.BLUE + '20', brand.PURPLE + '15']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.tag}
                        >
                            <Text style={[styles.tagText, { color: brand.BLUE }]}>📁 {product.category_name}</Text>
                        </LinearGradient>
                        <View style={[styles.tag, { backgroundColor: '#F0F0F0' }]}>
                            <Text style={styles.tagText}>
                                {product.region?.includes('UK') ? '🇬🇧 UK' :
                                    product.region?.includes('Canada') ? '🇨🇦 CA' :
                                        product.region?.includes('USA') ? '🇺🇸 US' : '🏷️ Deal'}
                            </Text>
                        </View>
                        <View style={[styles.tag, { backgroundColor: '#E0F2FE' }]}>
                            <Text style={[styles.tagText, { color: brand.BLUE }]}>📅 Today</Text>
                        </View>
                    </View>
                </View>

                {/* PROFIT CALCULATOR - ENHANCED */}
                {buyPrice > 0 && (
                    <LinearGradient
                        colors={['#F0F7FF', '#E0F2FE']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.profitCard}
                    >
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>📊 Profit Analysis</Text>
                        </View>
                        <View style={styles.profitGrid}>
                            <View style={styles.profitItem}>
                                <Text style={styles.profitLabel}>BUY PRICE</Text>
                                <Text style={[styles.profitValue, { color: '#666' }]}>
                                    {data.price_display ? renderPriceValue(data.price_display) : `$${buyPrice.toFixed(2)}`}
                                </Text>
                            </View>
                            {sellPrice > 0 && (
                                <>
                                    <View style={[styles.profitItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.1)', paddingLeft: 16 }]}>
                                        <Text style={styles.profitLabel}>SELL PRICE</Text>
                                        <Text style={[styles.profitValue, { color: brand.PURPLE }]}>
                                            ${sellPrice.toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={[styles.profitItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.1)', paddingLeft: 16 }]}>
                                        <Text style={styles.profitLabel}>NET PROFIT</Text>
                                        <Text style={[styles.profitValue, { color: profitColor, fontWeight: '900' }]}>
                                            ${formattedProfit}
                                        </Text>
                                    </View>
                                    <View style={[styles.profitItem, { borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.1)', paddingLeft: 16 }]}>
                                        <Text style={styles.profitLabel}>ROI %</Text>
                                        <Text style={[styles.profitValue, { color: roi > 0 ? '#10B981' : '#EF4444', fontWeight: '900' }]}>
                                            {roi}%
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </LinearGradient>
                )}

                {/* DESCRIPTION SECTION */}
                {data.description ? (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: '#000' }]}>📝 Description</Text>
                        <Text style={styles.descriptionText}>{data.description}</Text>
                    </View>
                ) : null}

                {/* PRODUCT DETAILS (FIELDS) */}
                {visibleDetails.length > 0 && (
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <Text style={[styles.sectionTitle, { color: '#000', marginBottom: 0 }]}>📋 Product Details</Text>
                            <Text style={{ fontSize: 11, color: '#999', fontWeight: '600' }}>Tap Item to Copy</Text>
                        </View>
                        <View style={styles.detailsContainer}>
                            {visibleDetails.map((detail, idx) => {
                                const copyable = isCopyable(detail.label);
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        activeOpacity={copyable ? 0.6 : 1}
                                        onPress={() => copyable && copyToClipboard(detail.value, detail.label)}
                                        style={[styles.detailRow, idx === visibleDetails.length - 1 && { borderBottomWidth: 0 }]}
                                    >
                                        <Text style={styles.detailLabel}>{detail.label}</Text>
                                        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <Text style={styles.detailValue}>{detail.value}</Text>
                                            {copyable && <Text style={{ marginLeft: 6, fontSize: 12, opacity: 0.3 }}>📋</Text>}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* RESEARCH LINKS SECTION */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: '#000' }]}>🔍 Research This Product</Text>
                    <View style={styles.linksContainer}>
                        {/* eBay Link */}
                        <LinkRow icon="🏷️" label="eBay Sold Listings" url={ebayLink} />
                        {/* Amazon Link */}
                        <LinkRow icon="📦" label="Amazon Pricing" url={amazonLink} />
                        {/* Google Link */}
                        <LinkRow icon="🌐" label="Google Search" url={googleLink} />
                        {/* Additional Product Links */}
                        {data.links && data.links.other && data.links.other.length > 0 && (
                            data.links.other.map((link, idx) => (
                                <LinkRow
                                    key={idx}
                                    icon="🔗"
                                    label={link.text || `Link ${idx + 1}`}
                                    url={link.url}
                                />
                            ))
                        )}
                    </View>
                </View>

                {/* WHERE TO BUY SECTION - ALL OPTIONS */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: '#000' }]}>🛒 Where to Buy</Text>
                    <View style={styles.linksContainer}>
                        {/* Primary Buy Link */}
                        {data.buy_url && (
                            <TouchableOpacity
                                style={styles.buyRow}
                                onPress={() => Linking.openURL(data.buy_url)}
                                activeOpacity={0.7}
                            >
                                <View>
                                    <Text style={styles.buyLabel}>Buy Now</Text>
                                    <Text style={styles.buySource}>Retail Price</Text>
                                </View>
                                <Text style={[styles.buyPrice, { color: '#10B981' }]}>
                                    ${buyPrice.toFixed(2)}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Buy Links from Product Data */}
                        {data.links && data.links.buy && data.links.buy.length > 0 && (
                            data.links.buy.map((link, idx) => (
                                <View key={idx}>
                                    {idx > 0 && <View style={[styles.divider, { marginVertical: 8 }]} />}
                                    <TouchableOpacity
                                        style={styles.buyRow}
                                        onPress={() => Linking.openURL(link.url)}
                                        activeOpacity={0.7}
                                    >
                                        <View>
                                            <Text style={styles.buyLabel}>{link.text || 'Buy Here'}</Text>
                                            <Text style={styles.buySource}>Retail Retailer</Text>
                                        </View>
                                        <Text style={[styles.buyPrice, { color: '#10B981' }]}>
                                            Visit ›
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}

                        {/* Resale Options */}
                        <View style={[styles.divider, { marginVertical: 12 }]} />
                        <TouchableOpacity
                            style={styles.buyRow}
                            onPress={() => Linking.openURL(ebayLink)}
                            activeOpacity={0.7}
                        >
                            <View>
                                <Text style={styles.buyLabel}>Resell on eBay</Text>
                                <Text style={styles.buySource}>View Similar Sales</Text>
                            </View>
                            <Text style={[styles.buyPrice, { color: brand.PURPLE }]}>
                                ${sellPrice.toFixed(2)}
                            </Text>
                        </TouchableOpacity>

                        {/* FBA Links */}
                        {data.links && data.links.fba && data.links.fba.length > 0 && (
                            <>
                                <View style={[styles.divider, { marginVertical: 8 }]} />
                                {data.links.fba.map((link, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.buyRow}
                                        onPress={() => Linking.openURL(link.url)}
                                        activeOpacity={0.7}
                                    >
                                        <View>
                                            <Text style={styles.buyLabel}>{link.text || 'Amazon FBA'}</Text>
                                            <Text style={styles.buySource}>Alternative Source</Text>
                                        </View>
                                        <Text style={[styles.buyPrice, { color: brand.BLUE }]}>
                                            Check ›
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                    </View>
                </View>

                {/* NOTES */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: '#000' }]}>📝 Deal Info</Text>
                    <View style={[styles.noteCard, { backgroundColor: '#FFFAED', borderColor: '#FCD34D' }]}>
                        <Text style={{ fontSize: 20, marginRight: 10 }}>💡</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.noteText}>
                                This deal was posted in {product.category_name}. Verify prices and stock before committing.
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* BOTTOM ACTION BAR */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#F5F5F5', flex: 1 }]}
                    onPress={() => toggleSave(product)}
                >
                    <Text style={styles.actionBtnText}>{saved ? '❤️ Saved' : '🤍 Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: brand.BLUE, flex: 1, marginLeft: 10 }]}
                    onPress={handleShare}
                >
                    <Text style={[styles.actionBtnText, { color: '#FFF', fontWeight: '900' }]}>📤 Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.viewSourceBtn, { backgroundColor: brand.BLUE }]}
                    onPress={() => data.buy_url && Linking.openURL(data.buy_url)}
                >
                    <Text style={styles.viewSourceText}>🔗 View Source</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)'
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        marginHorizontal: 4
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000',
        flex: 1,
        textAlign: 'center'
    },

    scrollContent: { paddingHorizontal: 20, paddingTop: 10 },

    imageContainer: {
        width: '100%',
        height: 320,
        backgroundColor: '#F0F0F0',
        borderRadius: 20,
        marginBottom: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5
    },
    image: { width: '100%', height: '100%', resizeMode: 'contain' },
    imageGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100
    },

    section: { marginBottom: 28 },
    title: { fontSize: 24, fontWeight: '900', marginBottom: 14, color: '#000', lineHeight: 32 },

    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    tagText: { fontSize: 13, fontWeight: '700' },

    profitCard: {
        borderRadius: 18,
        padding: 16,
        marginBottom: 28,
        shadowColor: '#2D82FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4
    },
    cardHeader: { marginBottom: 16 },
    cardTitle: { fontSize: 17, fontWeight: '900', color: '#000' },

    profitGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    profitItem: {
        flex: 1,
        paddingRight: 12
    },
    profitLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
        color: '#666',
        marginBottom: 6,
        textTransform: 'uppercase'
    },
    profitValue: { fontSize: 18, fontWeight: '900' },

    divider: {
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        marginVertical: 12
    },

    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 14,
        color: '#000',
        letterSpacing: 0.3
    },

    linksContainer: {
        backgroundColor: '#F8F9FE',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(45, 130, 255, 0.1)'
    },

    linkRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)'
    },
    linkText: { fontSize: 14, fontWeight: '600', color: '#000', flex: 1 },

    descriptionText: { fontSize: 14, color: '#4B5563', lineHeight: 22, fontWeight: '500' },

    detailsContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6'
    },
    detailLabel: { fontSize: 13, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase' },
    detailValue: { fontSize: 13, color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 10 },

    buyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14
    },
    buyLabel: { fontSize: 15, fontWeight: '700', color: '#000' },
    buySource: { fontSize: 12, color: '#999', marginTop: 2, fontWeight: '500' },
    buyPrice: { fontSize: 16, fontWeight: '900' },

    noteCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1
    },
    noteText: { fontSize: 13, fontWeight: '600', color: '#000', lineHeight: 18 },

    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingBottom: 24,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 8
    },

    actionBtn: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2
    },
    actionBtnText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },

    viewSourceBtn: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3
    },
    viewSourceText: { fontWeight: '900', fontSize: 14, color: '#FFF', letterSpacing: 0.3 },
    copiedToast: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        borderRadius: 12,
        zIndex: 1000,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10
    },
    copiedToastText: { color: '#FFF', fontWeight: 'bold' }
});

export default ProductDetailScreen;
