import { colors } from './colors';

export const globalStyles = {
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.05)',
  },

  cardRow: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
  },

  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  textName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#333',
  },

  textSecondary: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },

  verticalDivider: {
    width: 1.5,
    height: 30,
    backgroundColor: '#F0F0F0',
    marginLeft: 12,
    marginRight: 12,
  },

  dragIndicator: {
    opacity: 0.6,
    marginLeft: 8,
  },

  input: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    border: '1px solid #EEE',
    fontSize: 16,
    color: '#333',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
  },

  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
  },

  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#333',
    textAlign: 'center' as const,
    marginTop: 15,
    marginBottom: 15,
  },

  buttonText: {
    color: '#FFF',
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: 0.5,
  },
};