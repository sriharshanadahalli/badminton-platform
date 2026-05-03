const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Badminton Tournament API',
      version: '1.0.0',
      description: 'API documentation for the Badminton Tournament Management System backend.',
      contact: {
        name: 'Antigravity AI',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Local development server',
      },
    ],
    components: {
      schemas: {
        Player: {
          type: 'object',
          required: ['profileId', 'fullName'],
          properties: {
            profileId: { type: 'string', description: 'Unique identifier for the player' },
            fullName: { type: 'string', description: 'Full name of the player' },
          },
        },
        Category: {
          type: 'object',
          required: ['categoryId', 'categoryName'],
          properties: {
            categoryId: { type: 'string', description: 'Unique ID for the category (e.g., MS_OPEN)' },
            categoryName: { type: 'string', description: 'Human-readable name of the category' },
          },
        },
        Participation: {
          type: 'object',
          required: ['categoryId', 'player1Id'],
          properties: {
            categoryId: { type: 'string' },
            player1Id: { type: 'string' },
            player2Id: { type: 'string', nullable: true },
            seed: { type: 'number' },
          },
        },
        TournamentMatch: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            categoryId: { type: 'string' },
            roundNumber: { type: 'number' },
            roundName: { type: 'string' },
            matchIndex: { type: 'number' },
            status: { 
              type: 'string', 
              enum: ['Created', 'Assigned', 'Scheduled', 'Started', 'In Progress', 'Completed', 'Forfeited', 'BYE'] 
            },
            courtId: { type: 'string' },
            teams: {
              type: 'object',
              properties: {
                team1: { type: 'string', description: 'Participation ID for Team 1' },
                team2: { type: 'string', description: 'Participation ID for Team 2' },
              },
            },
            winner: { type: 'string' },
          },
        },
        Court: {
          type: 'object',
          properties: {
            courtId: { type: 'string' },
            name: { type: 'string' },
            activeMatchId: { type: 'string', nullable: true },
            upcomingMatchId: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
  apis: ['./server.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
