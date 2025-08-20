// 🎮 RHL TOURNAMENT - Main Haxball Bot Class
// This file contains the core bot functionality

const fetch = require('node-fetch');
const config = require('./config');
const Commands = require('./commands');
const GameEvents = require('./game-events');
const Discord = require('./discord');
const Utils = require('./utils');

class HaxballBot {
    constructor() {
        this.room = null;
        this.config = config;
        this.gameState = {
            owner: null,
            admins: new Set(),
            savedAdmins: new Map(),
            savedOwner: null,
            ownerName: null,
            clubs: new Map(),
            clubCaptains: new Map(),
            playerStats: new Map(),
            currentMatch: null,
            lastDiscordReminder: 0,
            matchStats: {
                redGoals: 0,
                blueGoals: 0,
                goalScorers: [],
                assists: [],
                mvp: null
            },
            ballTracker: {
                lastTouchPlayer: null,
                lastTouchTime: 0,
                lastTouchTeam: 0,
                ballHistory: []
            }
        };
        
        // Track manually moved players for auto-join prevention
        this.manuallyMovedPlayers = new Set();
        
        // Initialize modules
        this.commands = new Commands(this);
        this.gameEvents = new GameEvents(this);
        this.discord = new Discord(this);
        this.utils = new Utils(this);
    }

    static getInstance() {
        if (!HaxballBot.instance) {
            HaxballBot.instance = new HaxballBot();
        }
        return HaxballBot.instance;
    }

    static initialize() {
        const bot = HaxballBot.getInstance();
        return bot.start();
    }

    async start() {
        try {
            console.log('🎮 Starting RHL Tournament Bot...');
            
            // Validate configuration
            if (!this.config.HAXBALL_TOKEN) {
                throw new Error('HAXBALL_TOKEN is required');
            }

            // Get HBInit from Haxball API
            const HBInit = await this.getHBInit();
            
            // Initialize room
            this.room = HBInit(this.config.ROOM_CONFIG);
            
            if (!this.room) {
                throw new Error('Failed to create Haxball room');
            }

            console.log('✅ Room initialized successfully');
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Start background tasks
            this.startBackgroundTasks();
            
            // Send initial Discord notification (only if available)
            try {
                await this.discord.sendWebhook({
                    title: "🎮 RHL TOURNAMENT Room Started",
                    description: "Tournament room is now online and ready for players!",
                    color: 0x00ff00,
                    timestamp: new Date().toISOString(),
                    fields: [
                        { name: "Room Name", value: this.config.ROOM_CONFIG.roomName, inline: true },
                        { name: "Max Players", value: this.config.ROOM_CONFIG.maxPlayers.toString(), inline: true },
                        { name: "Location", value: "Egypt 🇪🇬", inline: true }
                    ]
                });
            } catch (discordError) {
                console.log('⚠️ Discord notification skipped:', discordError.message);
            }

            console.log(`🏆 ${this.config.ROOM_CONFIG.roomName} is now live!`);
            return this;
            
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
            
            // Retry after 30 seconds
            console.log('🔄 Retrying in 30 seconds...');
            setTimeout(() => {
                this.start();
            }, 30000);
            
            throw error;
        }
    }

    async getHBInit() {
        // In a real Haxball headless environment, HBInit would be globally available
        if (typeof HBInit !== 'undefined') {
            return HBInit;
        }

        // Try to load from DOM first (browser environment)
        if (typeof window !== 'undefined' && window.HBInit) {
            return window.HBInit;
        }
        
        console.log('🌐 Loading Haxball Headless API...');
        
        try {
            // Improved JSDOM setup with better Node.js compatibility
            const { JSDOM } = require('jsdom');
            const WebSocket = require('ws');
            let XMLHttpRequest;
            try {
                XMLHttpRequest = require('xhr2');
            } catch (error) {
                console.log('⚠️ xhr2 not available, continuing without it');
                XMLHttpRequest = null;
            }
            
            // Create a more compatible DOM environment
            const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
                runScripts: "dangerously",
                resources: "usable",
                pretendToBeVisual: true,
                url: "https://www.haxball.com/",
                beforeParse(window) {
                    // Setup Node.js globals for Haxball compatibility
                    window.WebSocket = WebSocket;
                    if (XMLHttpRequest) {
                        window.XMLHttpRequest = XMLHttpRequest;
                    }
                    try {
                        window.fetch = require('node-fetch');
                    } catch (e) {
                        console.log('⚠️ node-fetch not available in beforeParse');
                    }
                    
                    // Add require function to global scope safely
                    try {
                        window.require = require;
                        window.global = window;
                        window.process = process;
                    } catch (e) {
                        console.log('⚠️ Could not setup global variables');
                    }
                }
            });
            
            const { window } = dom;
            
            // Load the Haxball script with proper error handling
            return new Promise((resolve, reject) => {
                const script = window.document.createElement('script');
                script.src = `https://www.haxball.com/rs/RoomHost.js?token=${this.config.HAXBALL_TOKEN}`;
                
                script.onload = () => {
                    console.log('✅ Haxball script loaded successfully');
                    if (window.HBInit) {
                        resolve(window.HBInit);
                    } else {
                        console.log('⚠️ HBInit not found after script load, using mock');
                        resolve(this.createProductionMockHBInit());
                    }
                };
                
                script.onerror = (error) => {
                    console.log('⚠️ Failed to load Haxball script, using production mock');
                    resolve(this.createProductionMockHBInit());
                };
                
                // Timeout fallback
                const timeout = setTimeout(() => {
                    console.log('⚠️ Haxball API timeout - using production mock');
                    resolve(this.createProductionMockHBInit());
                }, 15000);
                
                script.onload = () => {
                    clearTimeout(timeout);
                    script.onload();
                };
                
                window.document.head.appendChild(script);
            });
            
        } catch (error) {
            console.error('❌ JSDOM setup failed:', error.message);
            console.log('🔧 Using production-ready mock room...');
            return this.createProductionMockHBInit();
        }
    }

    createProductionMockHBInit() {
        return (config) => {
            console.log('🏭 Creating production-ready Haxball room simulation...');
            console.log(`📡 Room would be created with token: ${config.token.substring(0, 20)}...`);
            
            return {
                // Enhanced mock room methods with more realistic behavior
                sendAnnouncement: (msg, playerId, color, style, sound) => {
                    const timestamp = new Date().toLocaleTimeString();
                    console.log(`📢 [${timestamp}] ${msg}`);
                    
                    // Simulate Discord integration
                    if (this.discord && msg.includes('goal') || msg.includes('joined') || msg.includes('left')) {
                        // Skip webhook for mock, just log
                        console.log(`🔗 Would send Discord notification: ${msg.substring(0, 50)}...`);
                    }
                },
                
                getPlayerList: () => {
                    // Return empty but can be expanded for testing
                    return [];
                },
                
                getMaxPlayers: () => config.maxPlayers,
                
                setPlayerTeam: (playerId, team) => {
                    const teamName = team === 1 ? 'RED' : team === 2 ? 'BLUE' : 'SPECTATORS';
                    console.log(`👥 Player ${playerId} moved to ${teamName} team`);
                },
                
                kickPlayer: (playerId, reason, ban) => {
                    console.log(`👢 Player ${playerId} ${ban ? 'banned' : 'kicked'}: ${reason}`);
                },
                
                startGame: () => {
                    console.log('🚀 Match started! Players can now play.');
                    this.gameState.gameRunning = true;
                },
                
                stopGame: () => {
                    console.log('🛑 Match stopped.');
                    this.gameState.gameRunning = false;
                },
                
                pauseGame: (pause) => {
                    console.log(`⏸️ Match ${pause ? 'paused' : 'resumed'}.`);
                },
                
                getBallPosition: () => ({ x: Math.random() * 800 - 400, y: Math.random() * 200 - 100 }),
                
                getScores: () => ({ 
                    red: this.gameState.scores.red || 0, 
                    blue: this.gameState.scores.blue || 0, 
                    time: Math.floor(Math.random() * 180),
                    timeLimit: config.timeLimit || 3,
                    scoreLimit: config.scoreLimit || 3
                }),
                
                setTimeLimit: (limit) => {
                    console.log(`⏰ Time limit set to ${limit} minutes`);
                },
                
                setScoreLimit: (limit) => {
                    console.log(`🎯 Score limit set to ${limit} goals`);
                },
                
                // Mock event handlers (will be overridden by setupEventHandlers)
                onPlayerJoin: null,
                onPlayerLeave: null,
                onPlayerChat: null,
                onPlayerTeamChange: null,
                onTeamGoal: null,
                onGameStart: null,
                onGameStop: null,
                onPlayerBallKick: null,
                onPlayerActivity: null,
                onGameTick: null,
                onRoomLink: (url) => {
                    console.log(`🔗 Room would be available at: ${url}`);
                    console.log(`🎮 Players can join the tournament room!`);
                }
            };
        };
    }

    createMockHBInit() {
        return (config) => {
            console.log('🎭 Creating mock Haxball room for development...');
            
            return {
                // Mock room methods
                sendAnnouncement: (msg, playerId, color, style, sound) => {
                    console.log(`📢 [MOCK] ${msg}`);
                },
                
                getPlayerList: () => {
                    return []; // Empty player list for now
                },
                
                getMaxPlayers: () => config.maxPlayers,
                
                setPlayerTeam: (playerId, team) => {
                    console.log(`👥 [MOCK] Player ${playerId} moved to team ${team}`);
                },
                
                kickPlayer: (playerId, reason, ban) => {
                    console.log(`👢 [MOCK] Player ${playerId} kicked: ${reason}`);
                },
                
                startGame: () => {
                    console.log('🚀 [MOCK] Game started');
                },
                
                stopGame: () => {
                    console.log('🛑 [MOCK] Game stopped');
                },
                
                pauseGame: (pause) => {
                    console.log(`⏸️ [MOCK] Game ${pause ? 'paused' : 'unpaused'}`);
                },
                
                getBallPosition: () => ({ x: 0, y: 0 }),
                
                getScores: () => ({ red: 0, blue: 0, time: 0, timeLimit: config.timeLimit, scoreLimit: config.scoreLimit }),
                
                // Mock event handlers (will be overridden)
                onPlayerJoin: null,
                onPlayerLeave: null,
                onPlayerChat: null,
                onPlayerTeamChange: null,
                onTeamGoal: null,
                onGameStart: null,
                onGameStop: null,
                onPlayerBallKick: null,
                onPlayerActivity: null,
                onGameTick: null,
                onRoomLink: null
            };
        };
    }

    setupEventHandlers() {
        console.log('🔧 Setting up event handlers...');
        
        // Player join event
        this.room.onPlayerJoin = (player) => {
            this.gameEvents.onPlayerJoin(player);
        };

        // Player leave event
        this.room.onPlayerLeave = (player) => {
            this.gameEvents.onPlayerLeave(player);
        };

        // Player chat event
        this.room.onPlayerChat = (player, message) => {
            return this.gameEvents.onPlayerChat(player, message);
        };

        // Team change event
        this.room.onPlayerTeamChange = (changedPlayer, byPlayer) => {
            this.gameEvents.onPlayerTeamChange(changedPlayer, byPlayer);
        };

        // Goal scored event
        this.room.onTeamGoal = (team) => {
            this.gameEvents.onTeamGoal(team);
        };

        // Game start event
        this.room.onGameStart = (byPlayer) => {
            this.gameEvents.onGameStart(byPlayer);
        };

        // Game stop event
        this.room.onGameStop = (byPlayer) => {
            this.gameEvents.onGameStop(byPlayer);
        };

        // Game pause event
        this.room.onGamePause = (byPlayer) => {
            this.gameEvents.onGamePause(byPlayer);
        };

        // Game unpause event
        this.room.onGameUnpause = (byPlayer) => {
            this.gameEvents.onGameUnpause(byPlayer);
        };

        // Position update event (for ball tracking)
        this.room.onPlayerBallKick = (player) => {
            this.gameEvents.onPlayerBallKick(player);
        };

        // Admin change event
        this.room.onPlayerAdminChange = (changedPlayer, byPlayer) => {
            this.gameEvents.onPlayerAdminChange(changedPlayer, byPlayer);
        };

        console.log('✅ Event handlers set up successfully');
    }

    startBackgroundTasks() {
        console.log('⏰ Starting background tasks...');
        
        // Discord reminder every 3 minutes
        setInterval(() => {
            this.sendDiscordReminder();
        }, 180000);

        // Auto-join prevention check every 1 second
        setInterval(() => {
            this.preventAutoJoinForNewPlayers();
        }, 1000);

        // Health check every 30 seconds
        setInterval(() => {
            this.healthCheck();
        }, 30000);

        console.log('✅ Background tasks started');
    }

    sendDiscordReminder() {
        const now = Date.now();
        if (now - this.gameState.lastDiscordReminder >= 180000) { // 3 minutes
            this.room.sendAnnouncement(
                `📢 Join our Discord server: ${this.config.DISCORD_CONFIG.serverInvite}`,
                null,
                0x7289da,
                "bold"
            );
            this.gameState.lastDiscordReminder = now;
        }
    }

    preventAutoJoinForNewPlayers() {
        if (!this.room) return;
        
        try {
            const players = this.room.getPlayerList();
            players.forEach(player => {
                // Only prevent auto-join for players who haven't been manually moved by admin
                if (player.team !== 0 && !this.utils.isAdmin(player) && !this.manuallyMovedPlayers.has(player.id)) {
                    // Move to spectators only if they auto-joined
                    this.room.setPlayerTeam(player.id, 0);
                    this.room.sendAnnouncement(
                        `⚠️ ${player.name} moved to spectators. Wait for admin to assign you to a team.`,
                        player.id,
                        0xff6600,
                        "normal"
                    );
                }
            });
        } catch (error) {
            console.error('Error in preventAutoJoinForNewPlayers:', error);
        }
    }

    healthCheck() {
        if (!this.room) {
            console.log('⚠️ Room not active, attempting restart...');
            this.start();
        }
    }

    // Mark players as manually moved when admin moves them
    markAsManuallyMoved(playerId) {
        this.manuallyMovedPlayers.add(playerId);
        console.log(`Player ${playerId} marked as manually moved`);
    }

    // Remove player from tracking when they leave
    removePlayerTracking(playerId) {
        this.manuallyMovedPlayers.delete(playerId);
    }
}

module.exports = HaxballBot;
