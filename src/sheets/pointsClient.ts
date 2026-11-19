import { api } from '../api'
import type { PointsRowValues } from './pointsSchema'

export const appendPointRow = (row: PointsRowValues) => api<void>('points', row)
