import swaggerJsdoc from 'swagger-jsdoc';
import { SERVER_VERSION } from './version.js';

const specs = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'sisRUA Unified API',
            version: SERVER_VERSION
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Local development'
            }
        ],
        components: {
            schemas: {
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        details: { type: 'string' }
                    }
                },
                DxfRequest: {
                    type: 'object',
                    required: ['lat', 'lon', 'radius', 'mode'],
                    properties: {
                        lat: { type: 'number', minimum: -90, maximum: 90 },
                        lon: { type: 'number', minimum: -180, maximum: 180 },
                        radius: { type: 'number', minimum: 10, maximum: 5000 },
                        mode: { type: 'string', enum: ['circle', 'polygon', 'bbox'] },
                        polygon: {
                            oneOf: [
                                { type: 'string' },
                                {
                                    type: 'array',
                                    items: {
                                        type: 'array',
                                        items: { type: 'number' },
                                        minItems: 2,
                                        maxItems: 2
                                    }
                                }
                            ]
                        },
                        layers: {
                            type: 'object',
                            additionalProperties: true
                        },
                        projection: { type: 'string', example: 'local' },
                        /** Campos ABNT NBR 10582 (carimbo) — todos opcionais */
                        designer: { type: 'string', maxLength: 60, description: 'Responsável pelo desenho (ABNT NBR 10582)', example: 'Eng. João Silva' },
                        numero_desenho: { type: 'string', maxLength: 20, description: 'Número do desenho (ABNT NBR 10582)', example: 'SR-0001' },
                        revisao: { type: 'string', maxLength: 3, description: 'Letra de revisão (ABNT NBR 10582)', example: 'A' },
                        verificado_por: { type: 'string', maxLength: 60, description: 'Verificado por (ABNT NBR 10582)', example: 'Eng. Maria Souza' },
                        aprovado_por: { type: 'string', maxLength: 60, description: 'Aprovado por (ABNT NBR 10582)', example: 'Arq. Carlos Lima' },
                    }
                },
                DxfQueuedResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'queued' },
                        jobId: { oneOf: [{ type: 'string' }, { type: 'number' }] }
                    }
                },
                DxfCachedResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'success' },
                        url: { type: 'string' }
                    }
                },
                JobStatusResponse: {
                    type: 'object',
                    properties: {
                        id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                        status: { type: 'string', enum: ['queued', 'active', 'completed', 'failed'] },
                        progress: { type: 'number' },
                        result: {
                            type: 'object',
                            nullable: true,
                            properties: {
                                url: { type: 'string' }
                            }
                        },
                        error: { type: 'string', nullable: true }
                    }
                },
                BatchResult: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        status: { type: 'string', enum: ['queued', 'cached'] },
                        jobId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                        url: { type: 'string' }
                    }
                },
                BatchError: {
                    type: 'object',
                    properties: {
                        line: { type: 'number' },
                        message: { type: 'string' }
                    }
                },
                BatchResponse: {
                    type: 'object',
                    properties: {
                        results: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/BatchResult' }
                        },
                        errors: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/BatchError' }
                        }
                    }
                },
                HealthResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        service: { type: 'string' },
                        version: { type: 'string' }
                    }
                },
                SearchRequest: {
                    type: 'object',
                    required: ['query'],
                    properties: {
                        query: { type: 'string' }
                    }
                },
                GeoLocation: {
                    type: 'object',
                    properties: {
                        lat: { type: 'number' },
                        lng: { type: 'number' },
                        label: { type: 'string' }
                    }
                },
                ElevationProfileRequest: {
                    type: 'object',
                    required: ['start', 'end'],
                    properties: {
                        start: { $ref: '#/components/schemas/GeoLocation' },
                        end: { $ref: '#/components/schemas/GeoLocation' },
                        steps: { type: 'number', example: 25 }
                    }
                },
                ElevationProfilePoint: {
                    type: 'object',
                    properties: {
                        dist: { type: 'number' },
                        elev: { type: 'number' }
                    }
                },
                ElevationProfileResponse: {
                    type: 'object',
                    properties: {
                        profile: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/ElevationProfilePoint' }
                        }
                    }
                },
                AnalyzeRequest: {
                    type: 'object',
                    required: ['stats', 'locationName'],
                    properties: {
                        stats: { type: 'object', additionalProperties: true },
                        locationName: { type: 'string' }
                    }
                },
                AnalyzeResponse: {
                    type: 'object',
                    properties: {
                        analysis: { type: 'string' }
                    }
                }
            }
        },
        paths: {
            '/': {
                get: {
                    summary: 'Health check',
                    responses: {
                        '200': {
                            description: 'Service status',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/HealthResponse' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/dxf': {
                post: {
                    summary: 'Queue DXF generation',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/DxfRequest' }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'DXF served from cache',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/DxfCachedResponse' }
                                }
                            }
                        },
                        '202': {
                            description: 'DXF job queued',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/DxfQueuedResponse' }
                                }
                            }
                        },
                        '400': {
                            description: 'Invalid request',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        },
                        '500': {
                            description: 'Generation failed',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/jobs/{id}': {
                get: {
                    summary: 'Get DXF job status',
                    parameters: [
                        {
                            name: 'id',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' }
                        }
                    ],
                    responses: {
                        '200': {
                            description: 'Job status',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/JobStatusResponse' }
                                }
                            }
                        },
                        '404': {
                            description: 'Job not found',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/batch/dxf': {
                post: {
                    summary: 'Batch DXF generation via CSV',
                    requestBody: {
                        required: true,
                        content: {
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        file: { type: 'string', format: 'binary' }
                                    },
                                    required: ['file']
                                }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Batch queued',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/BatchResponse' }
                                }
                            }
                        },
                        '400': {
                            description: 'Invalid CSV',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/search': {
                post: {
                    summary: 'Resolve location from query',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/SearchRequest' }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Resolved location',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/GeoLocation' }
                                }
                            }
                        },
                        '400': {
                            description: 'Query required',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        },
                        '404': {
                            description: 'Location not found',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/elevation/profile': {
                post: {
                    summary: 'Get elevation profile between two points',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ElevationProfileRequest' }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Elevation profile',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ElevationProfileResponse' }
                                }
                            }
                        },
                        '400': {
                            description: 'Invalid coordinates',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        }
                    }
                }
            },
            '/api/analyze': {
                post: {
                    summary: 'Analyze area using AI',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/AnalyzeRequest' }
                            }
                        }
                    },
                    responses: {
                        '200': {
                            description: 'Analysis result',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/AnalyzeResponse' }
                                }
                            }
                        },
                        '500': {
                            description: 'Analysis failed',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/ErrorResponse' }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    apis: []
});

export { specs };
