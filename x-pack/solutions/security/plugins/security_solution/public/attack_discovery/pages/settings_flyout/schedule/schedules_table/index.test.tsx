/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { SchedulesTable } from '.';
import { useScheduleApi } from '../logic/use_schedule_api';
import { mockFindAttackDiscoverySchedules } from '../../../mock/mock_find_attack_discovery_schedules';
import { useKibana } from '../../../../../common/lib/kibana';
import { ATTACK_DISCOVERY_FEATURE_ID } from '../../../../../../common/constants';

jest.mock('../../../../../common/lib/kibana');
jest.mock('../logic/use_schedule_api');

const mockUseScheduleApi = useScheduleApi as jest.MockedFunction<typeof useScheduleApi>;

const enableAttackDiscoveryScheduleMock = jest.fn();
const disableAttackDiscoveryScheduleMock = jest.fn();
const deleteAttackDiscoveryScheduleMock = jest.fn();
const refetchMock = jest.fn();

const mockUseFindSchedules = jest.fn();
const mockUseEnableSchedule = jest.fn();
const mockUseDisableSchedule = jest.fn();
const mockUseDeleteSchedule = jest.fn();

describe('SchedulesTable (pre-workflow, feature flag OFF)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useKibana as jest.Mock).mockReturnValue({
      services: {
        application: {
          capabilities: {
            [ATTACK_DISCOVERY_FEATURE_ID]: {
              updateAttackDiscoverySchedule: true,
            },
          },
        },
        telemetry: { reportEvent: jest.fn() },
      },
    });

    mockUseFindSchedules.mockReturnValue({
      data: mockFindAttackDiscoverySchedules,
      isLoading: false,
      refetch: refetchMock,
    });

    mockUseEnableSchedule.mockReturnValue({
      mutateAsync: enableAttackDiscoveryScheduleMock,
    });
    mockUseDisableSchedule.mockReturnValue({
      mutateAsync: disableAttackDiscoveryScheduleMock,
    });
    mockUseDeleteSchedule.mockReturnValue({
      mutateAsync: deleteAttackDiscoveryScheduleMock,
    });

    mockUseScheduleApi.mockReturnValue({
      isWorkflowsEnabled: false,
      useCreateSchedule: jest.fn(),
      useDeleteSchedule: mockUseDeleteSchedule,
      useDisableSchedule: mockUseDisableSchedule,
      useEnableSchedule: mockUseEnableSchedule,
      useFindSchedules: mockUseFindSchedules,
      useGetSchedule: jest.fn(),
      useUpdateSchedule: jest.fn(),
    } as unknown as ReturnType<typeof useScheduleApi>);
  });

  it('should render the schedules table container', () => {
    const { getByTestId } = render(<SchedulesTable />);

    expect(getByTestId('schedulesTableContainer')).toBeInTheDocument();
  });

  it('should render the schedules table description', () => {
    const { getByTestId } = render(<SchedulesTable />);

    expect(getByTestId('schedulesTableDescription')).toBeInTheDocument();
  });

  it('should render the correct number of rows in the schedules table', () => {
    const { getAllByRole } = render(<SchedulesTable />);

    expect(getAllByRole('row').length).toBe(1 + mockFindAttackDiscoverySchedules.schedules.length); // 1 header row + schedule rows
  });

  it('should invoke delete schedule mutation', async () => {
    const { getAllByTestId } = render(<SchedulesTable />);

    const firstDeleteButton = getAllByTestId('deleteButton')[0];
    act(() => {
      fireEvent.click(firstDeleteButton);
    });

    await waitFor(() => {
      expect(deleteAttackDiscoveryScheduleMock).toHaveBeenCalledWith({
        id: mockFindAttackDiscoverySchedules.schedules[0].id,
      });
    });
  });

  it('should invoke disable schedule mutation', async () => {
    const { getAllByTestId } = render(<SchedulesTable />);

    const firstSwitchButton = getAllByTestId('scheduleSwitch')[0];
    act(() => {
      fireEvent.click(firstSwitchButton);
    });

    await waitFor(() => {
      expect(disableAttackDiscoveryScheduleMock).toHaveBeenCalledWith({
        id: mockFindAttackDiscoverySchedules.schedules[0].id,
      });
    });
  });

  it('should invoke enable schedule mutation', async () => {
    const schedules = [
      mockFindAttackDiscoverySchedules.schedules[0],
      { ...mockFindAttackDiscoverySchedules.schedules[1], enabled: false },
    ];
    mockUseFindSchedules.mockReturnValue({
      data: { total: schedules.length, schedules },
      isLoading: false,
    });

    const { getAllByTestId } = render(<SchedulesTable />);

    const secondSwitchButton = getAllByTestId('scheduleSwitch')[1];
    act(() => {
      fireEvent.click(secondSwitchButton);
    });

    await waitFor(() => {
      expect(enableAttackDiscoveryScheduleMock).toHaveBeenCalledWith({
        id: schedules[1].id,
      });
    });
  });

  it('renders schedule names from public API data', () => {
    const { getByText } = render(<SchedulesTable />);

    for (const schedule of mockFindAttackDiscoverySchedules.schedules) {
      expect(getByText(schedule.name)).toBeInTheDocument();
    }
  });

  it('renders with useScheduleApi returning isWorkflowsEnabled false', () => {
    render(<SchedulesTable />);

    expect(mockUseScheduleApi).toHaveBeenCalled();
    expect(mockUseScheduleApi.mock.results[0].value.isWorkflowsEnabled).toBe(false);
  });

  it('calls refetch after disabling a schedule', async () => {
    const { getAllByTestId } = render(<SchedulesTable />);

    const firstSwitchButton = getAllByTestId('scheduleSwitch')[0];
    act(() => {
      fireEvent.click(firstSwitchButton);
    });

    await waitFor(() => {
      expect(disableAttackDiscoveryScheduleMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalled();
    });
  });

  it('calls refetch after enabling a schedule', async () => {
    const schedules = [{ ...mockFindAttackDiscoverySchedules.schedules[0], enabled: false }];
    mockUseFindSchedules.mockReturnValue({
      data: { total: schedules.length, schedules },
      isLoading: false,
      refetch: refetchMock,
    });

    const { getAllByTestId } = render(<SchedulesTable />);

    const firstSwitchButton = getAllByTestId('scheduleSwitch')[0];
    act(() => {
      fireEvent.click(firstSwitchButton);
    });

    await waitFor(() => {
      expect(enableAttackDiscoveryScheduleMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalled();
    });
  });

  it('calls refetch after deleting a schedule', async () => {
    const { getAllByTestId } = render(<SchedulesTable />);

    const firstDeleteButton = getAllByTestId('deleteButton')[0];
    act(() => {
      fireEvent.click(firstDeleteButton);
    });

    await waitFor(() => {
      expect(deleteAttackDiscoveryScheduleMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalled();
    });
  });
});
