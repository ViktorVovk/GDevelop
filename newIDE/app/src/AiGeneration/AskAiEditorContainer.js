// @flow
import * as React from 'react';
import { type I18n as I18nType } from '@lingui/core';
import { I18n } from '@lingui/react';
import {
  type RenderEditorContainerPropsWithRef,
  type SceneEventsOutsideEditorChanges,
} from '../MainFrame/EditorContainers/BaseEditor';
import { type ObjectWithContext } from '../ObjectsList/EnumerateObjects';
import Paper from '../UI/Paper';
import { AiRequestChat, type AiRequestChatInterface } from './AiRequestChat';
import {
  addMessageToAiRequest,
  createAiRequest,
  getAiRequest,
  sendAiRequestFeedback,
  type AiRequest,
  type AiRequestMessageAssistantFunctionCall,
} from '../Utils/GDevelopServices/Generation';
import { delay } from '../Utils/Delay';
import AuthenticatedUserContext from '../Profile/AuthenticatedUserContext';
import { Toolbar } from './Toolbar';
import { AskAiHistory } from './AskAiHistory';
import { makeSimplifiedProjectBuilder } from '../EditorFunctions/SimplifiedProject/SimplifiedProject';
import {
  canUpgradeSubscription,
  hasValidSubscriptionPlan,
} from '../Utils/GDevelopServices/Usage';
import { retryIfFailed } from '../Utils/RetryIfFailed';
import { CreditsPackageStoreContext } from '../AssetStore/CreditsPackages/CreditsPackageStoreContext';
import {
  processEditorFunctionCalls,
  type EditorFunctionCallResult,
} from '../EditorFunctions/EditorFunctionCallRunner';
import { type EditorCallbacks } from '../EditorFunctions';
import {
  getFunctionCallOutputsFromEditorFunctionCallResults,
  getFunctionCallsToProcess,
} from './AiRequestUtils';
import { useStableUpToDateRef } from '../Utils/UseStableUpToDateCallback';
import { useTriggerAtNextRender } from '../Utils/useTriggerAtNextRender';
import { type NewProjectSetup } from '../ProjectCreation/NewProjectSetupDialog';
import { type FileMetadata, type StorageProvider } from '../ProjectsStorage';
import { useEnsureExtensionInstalled } from './UseEnsureExtensionInstalled';
import { useGenerateEvents } from './UseGenerateEvents';
import { useSearchAndInstallAsset } from './UseSearchAndInstallAsset';
import { type ResourceManagementProps } from '../ResourcesList/ResourceSource';
import {
  sendAiRequestMessageSent,
  sendAiRequestStarted,
} from '../Utils/Analytics/EventSender';
import { useCreateAiProjectDialog } from './UseCreateAiProjectDialog';
import { type ExampleShortHeader } from '../Utils/GDevelopServices/Example';
import { prepareAiUserContent } from './PrepareAiUserContent';
import { AiRequestContext } from './AiRequestContext';

const gd: libGDevelop = global.gd;

const useProcessFunctionCalls = ({
  i18n,
  project,
  resourceManagementProps,
  editorCallbacks,
  selectedAiRequest,
  onSendEditorFunctionCallResults,
  getEditorFunctionCallResults,
  addEditorFunctionCallResults,
  onSceneEventsModifiedOutsideEditor,
  onExtensionInstalled,
}: {|
  i18n: I18nType,
  project: gdProject | null,
  resourceManagementProps: ResourceManagementProps,
  editorCallbacks: EditorCallbacks,
  selectedAiRequest: ?AiRequest,
  onSendEditorFunctionCallResults: (
    options: null | {| createdSceneNames: Array<string> |}
  ) => Promise<void>,
  getEditorFunctionCallResults: string => Array<EditorFunctionCallResult> | null,
  addEditorFunctionCallResults: (
    string,
    Array<EditorFunctionCallResult>
  ) => void,
  onSceneEventsModifiedOutsideEditor: (
    changes: SceneEventsOutsideEditorChanges
  ) => void,
  onExtensionInstalled: (extensionNames: Array<string>) => void,
|}) => {
  const { ensureExtensionInstalled } = useEnsureExtensionInstalled({
    project,
    i18n,
  });
  const { searchAndInstallAsset } = useSearchAndInstallAsset({
    project,
    resourceManagementProps,
    onExtensionInstalled,
  });
  const { generateEvents } = useGenerateEvents({ project });

  const triggerSendEditorFunctionCallResults = useTriggerAtNextRender(
    onSendEditorFunctionCallResults
  );

  const [
    aiRequestAutoProcessState,
    setAiRequestAutoprocessState,
  ] = React.useState<{
    [string]: boolean,
  }>({});
  const isAutoProcessingFunctionCalls = React.useCallback(
    (aiRequestId: string) =>
      aiRequestAutoProcessState[aiRequestId] !== undefined
        ? aiRequestAutoProcessState[aiRequestId]
        : true,
    [aiRequestAutoProcessState]
  );

  const setAutoProcessFunctionCalls = React.useCallback(
    (aiRequestId: string, shouldAutoProcess: boolean) => {
      setAiRequestAutoprocessState(aiRequestAutoProcessState => ({
        ...aiRequestAutoProcessState,
        [aiRequestId]: shouldAutoProcess,
      }));
    },
    [setAiRequestAutoprocessState]
  );

  const onProcessFunctionCalls = React.useCallback(
    async (
      functionCalls: Array<AiRequestMessageAssistantFunctionCall>,
      options: ?{|
        ignore?: boolean,
      |}
    ) => {
      if (!project || !selectedAiRequest) return;

      addEditorFunctionCallResults(
        selectedAiRequest.id,
        functionCalls.map(functionCall => ({
          status: 'working',
          call_id: functionCall.call_id,
        }))
      );

      const { results, createdSceneNames } = await processEditorFunctionCalls({
        project,
        editorCallbacks,
        functionCalls: functionCalls.map(functionCall => ({
          name: functionCall.name,
          arguments: functionCall.arguments,
          call_id: functionCall.call_id,
        })),
        ignore: !!options && !!options.ignore,
        generateEvents: async options => {
          return await generateEvents({
            ...options,
            relatedAiRequestId: selectedAiRequest.id,
          });
        },
        onSceneEventsModifiedOutsideEditor,
        ensureExtensionInstalled,
        searchAndInstallAsset,
      });

      addEditorFunctionCallResults(selectedAiRequest.id, results);

      // We may have processed everything, so try to send the results
      // to the backend.
      triggerSendEditorFunctionCallResults({
        createdSceneNames,
      });
    },
    [
      project,
      selectedAiRequest,
      addEditorFunctionCallResults,
      ensureExtensionInstalled,
      searchAndInstallAsset,
      generateEvents,
      onSceneEventsModifiedOutsideEditor,
      triggerSendEditorFunctionCallResults,
      editorCallbacks,
    ]
  );

  const allFunctionCallsToProcess = React.useMemo(
    () =>
      selectedAiRequest
        ? getFunctionCallsToProcess({
            aiRequest: selectedAiRequest,
            editorFunctionCallResults: getEditorFunctionCallResults(
              selectedAiRequest.id
            ),
          })
        : [],
    [selectedAiRequest, getEditorFunctionCallResults]
  );

  React.useEffect(
    () => {
      (async () => {
        if (!selectedAiRequest) return;

        if (isAutoProcessingFunctionCalls(selectedAiRequest.id)) {
          if (allFunctionCallsToProcess.length === 0) {
            return;
          }
          console.info('Automatically processing AI function calls...');
          await onProcessFunctionCalls(allFunctionCallsToProcess);
        }
      })();
    },
    [
      selectedAiRequest,
      isAutoProcessingFunctionCalls,
      onProcessFunctionCalls,
      allFunctionCallsToProcess,
    ]
  );

  return {
    isAutoProcessingFunctionCalls,
    setAutoProcessFunctionCalls,
    onProcessFunctionCalls,
  };
};

export const useSelectedAiRequest = ({
  initialAiRequestId,
}: {|
  initialAiRequestId: string | null,
|}) => {
  const { profile, getAuthorizationHeader } = React.useContext(
    AuthenticatedUserContext
  );
  const { aiRequestStorage } = React.useContext(AiRequestContext);
  const { aiRequests, updateAiRequest } = aiRequestStorage;

  const [selectedAiRequestId, setSelectedAiRequestId] = React.useState<
    string | null
  >(initialAiRequestId);

  const selectedAiRequest =
    (selectedAiRequestId && aiRequests[selectedAiRequestId]) || null;

  // If the selected AI request is in a "working" state, watch it until it's finished.
  const status = selectedAiRequest ? selectedAiRequest.status : null;
  React.useEffect(
    () => {
      if (!profile) return;
      if (!selectedAiRequestId || !status) return;

      let stopWatching = false;

      const watch = async () => {
        while (true) {
          await delay(1000);
          if (stopWatching) return;

          const aiRequest = await getAiRequest(getAuthorizationHeader, {
            userId: profile.id,
            aiRequestId: selectedAiRequestId,
          });
          if (stopWatching) return;

          updateAiRequest(selectedAiRequestId, aiRequest);
        }
      };

      if (status === 'working') {
        console.info(`Started watching AI request ${selectedAiRequestId}.`);
        watch();
      }

      return () => {
        if (status === 'working') {
          console.info(`Stopped watching AI request ${selectedAiRequestId}.`);
        }
        stopWatching = true;
      };
    },
    [
      selectedAiRequestId,
      status,
      profile,
      getAuthorizationHeader,
      updateAiRequest,
    ]
  );

  return {
    selectedAiRequest,
    selectedAiRequestId,
    setSelectedAiRequestId,
  };
};

const styles = {
  paper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 0,
    overflowY: 'scroll',
    overflowX: 'hidden',
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: 'min(100%, 800px)',
    marginLeft: 10,
    marginRight: 10,
    marginBottom: 10,
    minHeight: 0,
    minWidth: 0,
  },
};

type Props = {|
  isActive: boolean,
  project: gdProject | null,
  resourceManagementProps: ResourceManagementProps,
  fileMetadata: ?FileMetadata,
  storageProvider: ?StorageProvider,
  setToolbar: (?React.Node) => void,
  i18n: I18nType,
  onCreateEmptyProject: (newProjectSetup: NewProjectSetup) => Promise<void>,
  onCreateProjectFromExample: (
    exampleShortHeader: ExampleShortHeader,
    newProjectSetup: NewProjectSetup,
    i18n: I18nType,
    isQuickCustomization?: boolean
  ) => Promise<void>,
  onOpenLayout: (
    sceneName: string,
    options: {|
      openEventsEditor: boolean,
      openSceneEditor: boolean,
      focusWhenOpened:
        | 'scene-or-events-otherwise'
        | 'scene'
        | 'events'
        | 'none',
    |}
  ) => void,
  onSceneEventsModifiedOutsideEditor: (
    changes: SceneEventsOutsideEditorChanges
  ) => void,
  onExtensionInstalled: (extensionNames: Array<string>) => void,
  initialMode: 'chat' | 'agent' | null,
  initialAiRequestId: string | null,
  onOpenAskAi: ({|
    mode: 'chat' | 'agent',
    aiRequestId: string | null,
    paneIdentifier: 'left' | 'center' | 'right' | null,
  |}) => void,
|};

export type AskAiEditorInterface = {|
  getProject: () => void,
  updateToolbar: () => void,
  forceUpdateEditor: () => void,
  onEventsBasedObjectChildrenEdited: () => void,
  onSceneObjectEdited: (
    scene: gdLayout,
    objectWithContext: ObjectWithContext
  ) => void,
  onSceneObjectsDeleted: (scene: gdLayout) => void,
  onSceneEventsModifiedOutsideEditor: (
    changes: SceneEventsOutsideEditorChanges
  ) => void,
  startOrOpenChat: ({|
    mode: 'chat' | 'agent',
    aiRequestId: string | null,
  |}) => void,
|};

export type NewAiRequestOptions = {|
  mode: 'chat' | 'agent',
  userRequest: string,
|};

const noop = () => {};

export const AskAiEditor = React.memo<Props>(
  React.forwardRef<Props, AskAiEditorInterface>(
    (
      {
        isActive,
        setToolbar,
        project,
        resourceManagementProps,
        fileMetadata,
        storageProvider,
        i18n,
        onCreateEmptyProject,
        onCreateProjectFromExample,
        onOpenLayout,
        onSceneEventsModifiedOutsideEditor,
        onExtensionInstalled,
        initialMode,
        initialAiRequestId,
        onOpenAskAi,
      }: Props,
      ref
    ) => {
      const editorCallbacks: EditorCallbacks = React.useMemo(
        () => ({
          onOpenLayout,
        }),
        [onOpenLayout]
      );

      const {
        selectedAiRequest,
        selectedAiRequestId,
        setSelectedAiRequestId,
      } = useSelectedAiRequest({
        initialAiRequestId,
      });
      const upToDateSelectedAiRequestId = useStableUpToDateRef(
        selectedAiRequestId
      );

      const [
        newAiRequestOptions,
        startNewAiRequest,
      ] = React.useState<NewAiRequestOptions | null>(null);

      const [isHistoryOpen, setIsHistoryOpen] = React.useState<boolean>(false);
      const [newChatMode, setNewChatMode] = React.useState<'chat' | 'agent'>(
        initialMode || 'agent'
      );

      // Update newChatMode when mode prop changes
      React.useEffect(
        () => {
          if (initialMode) {
            setNewChatMode(initialMode);
          }
        },
        [initialMode]
      );

      const canStartNewChat = !!selectedAiRequestId;
      const onStartOrOpenChat = React.useCallback(
        ({
          mode,
          aiRequestId,
        }: {|
          mode: 'chat' | 'agent',
          aiRequestId: string | null,
        |}) => {
          setSelectedAiRequestId(aiRequestId);
          setNewChatMode(mode);
        },
        [setSelectedAiRequestId]
      );

      const onOpenHistory = React.useCallback(() => {
        setIsHistoryOpen(true);
      }, []);

      const onCloseHistory = React.useCallback(() => {
        setIsHistoryOpen(false);
      }, []);

      const {
        aiRequestStorage,
        editorFunctionCallResultsStorage,
      } = React.useContext(AiRequestContext);
      const {
        getEditorFunctionCallResults,
        addEditorFunctionCallResults,
        clearEditorFunctionCallResults,
      } = editorFunctionCallResultsStorage;
      const {
        updateAiRequest,
        refreshAiRequest,
        isSendingAiRequest,
        getLastSendError,
        setSendingAiRequest,
        setLastSendError,
      } = aiRequestStorage;

      const {
        createAiProject,
        renderCreateAiProjectDialog,
      } = useCreateAiProjectDialog();

      const updateToolbar = React.useCallback(
        () => {
          if (setToolbar) {
            setToolbar(
              <Toolbar
                onStartOrOpenChat={onStartOrOpenChat}
                canStartNewChat={canStartNewChat}
                onOpenHistory={onOpenHistory}
              />
            );
          }
        },
        [setToolbar, onStartOrOpenChat, canStartNewChat, onOpenHistory]
      );

      React.useEffect(updateToolbar, [updateToolbar]);

      React.useImperativeHandle(ref, () => ({
        getProject: noop,
        updateToolbar,
        forceUpdateEditor: noop,
        onEventsBasedObjectChildrenEdited: noop,
        onSceneObjectEdited: noop,
        onSceneObjectsDeleted: noop,
        onSceneEventsModifiedOutsideEditor: noop,
        startOrOpenChat: onStartOrOpenChat,
      }));

      const aiRequestChatRef = React.useRef<AiRequestChatInterface | null>(
        null
      );

      const { openCreditsPackageDialog } = React.useContext(
        CreditsPackageStoreContext
      );

      const {
        profile,
        getAuthorizationHeader,
        onOpenCreateAccountDialog,
        limits,
        onRefreshLimits,
        subscription,
      } = React.useContext(AuthenticatedUserContext);

      const availableCredits = limits ? limits.credits.userBalance.amount : 0;
      const quota =
        (limits && limits.quotas && limits.quotas['ai-request']) || null;
      const aiRequestPrice =
        (limits && limits.credits && limits.credits.prices['ai-request']) ||
        null;
      const aiRequestPriceInCredits = aiRequestPrice
        ? aiRequestPrice.priceInCredits
        : null;

      // Refresh limits when navigating ot this tab, as we want to be sure
      // we display the proper quota and credits information for the user.
      React.useEffect(
        () => {
          if (isActive) {
            onRefreshLimits();
          }
        },
        [isActive, onRefreshLimits]
      );

      // Trigger the start of the new AI request if the user has requested it
      // (or if triggered automatically by setting `newAiRequestOptions`, for example
      // after waiting for the project to be created for an AI agent request).
      React.useEffect(
        () => {
          (async () => {
            if (!newAiRequestOptions) return;
            console.info('Starting a new AI request...');

            if (!profile) {
              onOpenCreateAccountDialog();
              startNewAiRequest(null);
              return;
            }

            // Read the options and reset them (to avoid launching the same request twice).
            const { mode, userRequest } = newAiRequestOptions;
            startNewAiRequest(null);

            // If no project is opened, create a new empty one if the request is for
            // the AI agent.
            if (mode === 'agent' && !project) {
              try {
                console.info(
                  'No project opened, opening the dialog to create a new project.'
                );
                const result = await createAiProject();
                if (result === 'canceled') {
                  return;
                }
                console.info('New project created - starting AI request.');
                startNewAiRequest({
                  mode,
                  userRequest,
                });
              } catch (error) {
                console.error('Error creating a new empty project:', error);
              }
              return;
            }

            // Ensure the user has enough credits to pay for the request, or ask them
            // to buy some more.
            let payWithCredits = false;
            if (quota && quota.limitReached && aiRequestPriceInCredits) {
              payWithCredits = true;
              if (availableCredits < aiRequestPriceInCredits) {
                openCreditsPackageDialog({
                  missingCredits: aiRequestPriceInCredits - availableCredits,
                });
                return;
              }
            }

            // Request is now ready to be started.
            try {
              const simplifiedProjectBuilder = makeSimplifiedProjectBuilder(gd);
              const simplifiedProjectJson = project
                ? JSON.stringify(
                    simplifiedProjectBuilder.getSimplifiedProject(project, {})
                  )
                : null;
              const projectSpecificExtensionsSummaryJson = project
                ? JSON.stringify(
                    simplifiedProjectBuilder.getProjectSpecificExtensionsSummary(
                      project
                    )
                  )
                : null;
              const storageProviderName = storageProvider
                ? storageProvider.internalName
                : null;

              setSendingAiRequest(null, true);

              const preparedAiUserContent = await prepareAiUserContent({
                getAuthorizationHeader,
                userId: profile.id,
                simplifiedProjectJson,
                projectSpecificExtensionsSummaryJson,
              });

              const aiRequest = await createAiRequest(getAuthorizationHeader, {
                userRequest: userRequest,
                userId: profile.id,
                ...preparedAiUserContent,
                payWithCredits,
                gameId: project ? project.getProjectUuid() : null,
                fileMetadata,
                storageProviderName,
                mode,
              });

              console.info('Successfully created a new AI request:', aiRequest);
              setSendingAiRequest(null, false);
              updateAiRequest(aiRequest.id, aiRequest);

              // Select the new AI request just created - unless the user switched to another one
              // in the meantime.
              if (!upToDateSelectedAiRequestId.current) {
                setSelectedAiRequestId(aiRequest.id);
              }

              if (aiRequestChatRef.current)
                aiRequestChatRef.current.resetUserInput(selectedAiRequestId);

              sendAiRequestStarted({
                simplifiedProjectJsonLength: simplifiedProjectJson
                  ? simplifiedProjectJson.length
                  : 0,
                projectSpecificExtensionsSummaryJsonLength: projectSpecificExtensionsSummaryJson
                  ? projectSpecificExtensionsSummaryJson.length
                  : 0,
                payWithCredits,
                storageProviderName,
                mode,
                aiRequestId: aiRequest.id,
              });
            } catch (error) {
              console.error('Error starting a new AI request:', error);
              setLastSendError(null, error);
            }

            // Refresh the user limits, to ensure quota and credits information
            // is up-to-date after an AI request.
            await delay(500);
            try {
              await retryIfFailed({ times: 2 }, onRefreshLimits);
            } catch (error) {
              // Ignore limits refresh error.
            }
          })();
        },
        [
          aiRequestPriceInCredits,
          availableCredits,
          getAuthorizationHeader,
          onOpenCreateAccountDialog,
          onRefreshLimits,
          openCreditsPackageDialog,
          profile,
          project,
          fileMetadata,
          storageProvider,
          quota,
          selectedAiRequestId,
          setLastSendError,
          setSelectedAiRequestId,
          setSendingAiRequest,
          upToDateSelectedAiRequestId,
          updateAiRequest,
          createAiProject,
          newAiRequestOptions,
          onOpenAskAi,
        ]
      );

      const hasFunctionsCallsToProcess = React.useMemo(
        () =>
          selectedAiRequest
            ? getFunctionCallsToProcess({
                aiRequest: selectedAiRequest,
                editorFunctionCallResults: getEditorFunctionCallResults(
                  selectedAiRequest.id
                ),
              }).length > 0
            : false,
        [selectedAiRequest, getEditorFunctionCallResults]
      );

      // Send the results of the function call outputs, if any, and the user message (if any).
      const onSendMessage = React.useCallback(
        async ({
          userMessage,
          createdSceneNames,
        }: {|
          userMessage: string,
          createdSceneNames?: Array<string>,
        |}) => {
          if (
            !profile ||
            !selectedAiRequestId ||
            isSendingAiRequest(selectedAiRequestId)
          )
            return;

          // Read the results from the editor that applied the function calls.
          // and transform them into the output that will be stored on the AI request.
          const {
            hasUnfinishedResult,
            functionCallOutputs,
          } = getFunctionCallOutputsFromEditorFunctionCallResults(
            getEditorFunctionCallResults(selectedAiRequestId)
          );

          // If anything is not finished yet, stop there (we only send all
          // results at once, AI do not support partial results).
          if (hasUnfinishedResult) return;
          if (hasFunctionsCallsToProcess) return;

          // If nothing to send, stop there.
          if (functionCallOutputs.length === 0 && !userMessage) return;

          // Paying with credits is only when a user message is sent (and quota is exhausted).
          let payWithCredits = false;
          if (
            userMessage &&
            quota &&
            quota.limitReached &&
            aiRequestPriceInCredits
          ) {
            payWithCredits = true;
            if (availableCredits < aiRequestPriceInCredits) {
              openCreditsPackageDialog({
                missingCredits: aiRequestPriceInCredits - availableCredits,
              });
              return;
            }
          }

          try {
            setSendingAiRequest(selectedAiRequestId, true);

            const simplifiedProjectBuilder = makeSimplifiedProjectBuilder(gd);
            const simplifiedProjectJson = project
              ? JSON.stringify(
                  simplifiedProjectBuilder.getSimplifiedProject(project, {})
                )
              : null;
            const projectSpecificExtensionsSummaryJson = project
              ? JSON.stringify(
                  simplifiedProjectBuilder.getProjectSpecificExtensionsSummary(
                    project
                  )
                )
              : null;

            const preparedAiUserContent = await prepareAiUserContent({
              getAuthorizationHeader,
              userId: profile.id,
              simplifiedProjectJson,
              projectSpecificExtensionsSummaryJson,
            });

            const aiRequest: AiRequest = await retryIfFailed({ times: 2 }, () =>
              addMessageToAiRequest(getAuthorizationHeader, {
                userId: profile.id,
                aiRequestId: selectedAiRequestId,
                functionCallOutputs,
                ...preparedAiUserContent,
                payWithCredits,
                userMessage,
              })
            );
            updateAiRequest(aiRequest.id, aiRequest);
            setSendingAiRequest(aiRequest.id, false);
            clearEditorFunctionCallResults(aiRequest.id);

            if (userMessage) {
              sendAiRequestMessageSent({
                simplifiedProjectJsonLength: simplifiedProjectJson
                  ? simplifiedProjectJson.length
                  : 0,
                projectSpecificExtensionsSummaryJsonLength: projectSpecificExtensionsSummaryJson
                  ? projectSpecificExtensionsSummaryJson.length
                  : 0,
                payWithCredits,
                mode: aiRequest.mode || 'chat',
                aiRequestId: aiRequest.id,
                outputLength: aiRequest.output.length,
              });
            }
          } catch (error) {
            // TODO: update the label of the button to send again.
            setLastSendError(selectedAiRequestId, error);
          }

          if (userMessage) {
            if (aiRequestChatRef.current)
              aiRequestChatRef.current.resetUserInput(selectedAiRequestId);

            // Refresh the user limits, to ensure quota and credits information
            // is up-to-date after an AI request.
            await delay(500);
            try {
              await retryIfFailed({ times: 2 }, onRefreshLimits);
            } catch (error) {
              // Ignore limits refresh error.
            }
          }

          if (selectedAiRequest && createdSceneNames) {
            onOpenAskAi({
              mode: selectedAiRequest.mode || 'agent',
              aiRequestId: selectedAiRequestId,
              paneIdentifier: 'right',
            });
            createdSceneNames.forEach(sceneName => {
              onOpenLayout(sceneName, {
                openEventsEditor: true,
                openSceneEditor: true,
                focusWhenOpened: 'scene',
              });
            });
          }
        },
        [
          profile,
          selectedAiRequest,
          selectedAiRequestId,
          isSendingAiRequest,
          getEditorFunctionCallResults,
          quota,
          aiRequestPriceInCredits,
          availableCredits,
          openCreditsPackageDialog,
          setSendingAiRequest,
          updateAiRequest,
          clearEditorFunctionCallResults,
          getAuthorizationHeader,
          setLastSendError,
          onRefreshLimits,
          project,
          hasFunctionsCallsToProcess,
          onOpenAskAi,
          onOpenLayout,
        ]
      );
      const onSendEditorFunctionCallResults = React.useCallback(
        (options: null | {| createdSceneNames: Array<string> |}) =>
          onSendMessage({
            userMessage: '',
            createdSceneNames: options ? options.createdSceneNames : [],
          }),
        [onSendMessage]
      );

      const onSendFeedback = React.useCallback(
        async (
          aiRequestId,
          messageIndex,
          feedback,
          reason,
          freeFormDetails
        ) => {
          if (!profile) return;
          try {
            await retryIfFailed({ times: 2 }, () =>
              sendAiRequestFeedback(getAuthorizationHeader, {
                userId: profile.id,
                aiRequestId,
                messageIndex,
                feedback,
                reason,
                freeFormDetails,
              })
            );
          } catch (error) {
            console.error('Error sending feedback: ', error);
          }
        },
        [getAuthorizationHeader, profile]
      );

      const {
        isAutoProcessingFunctionCalls,
        setAutoProcessFunctionCalls,
        onProcessFunctionCalls,
      } = useProcessFunctionCalls({
        project,
        resourceManagementProps,
        selectedAiRequest,
        editorCallbacks,
        onSendEditorFunctionCallResults,
        getEditorFunctionCallResults,
        addEditorFunctionCallResults,
        onSceneEventsModifiedOutsideEditor,
        i18n,
        onExtensionInstalled,
      });

      return (
        <>
          <Paper square background="dark" style={styles.paper}>
            <div style={styles.chatContainer}>
              <AiRequestChat
                project={project || null}
                ref={aiRequestChatRef}
                aiRequest={selectedAiRequest}
                onStartNewAiRequest={startNewAiRequest}
                onSendMessage={onSendMessage}
                isSending={isSendingAiRequest(selectedAiRequestId)}
                lastSendError={getLastSendError(selectedAiRequestId)}
                quota={quota}
                increaseQuotaOffering={
                  !hasValidSubscriptionPlan(subscription)
                    ? 'subscribe'
                    : canUpgradeSubscription(subscription)
                    ? 'upgrade'
                    : 'none'
                }
                onProcessFunctionCalls={onProcessFunctionCalls}
                editorFunctionCallResults={
                  (selectedAiRequest &&
                    getEditorFunctionCallResults(selectedAiRequest.id)) ||
                  null
                }
                price={aiRequestPrice}
                availableCredits={availableCredits}
                onSendFeedback={onSendFeedback}
                hasOpenedProject={!!project}
                isAutoProcessingFunctionCalls={
                  selectedAiRequest
                    ? isAutoProcessingFunctionCalls(selectedAiRequest.id)
                    : false
                }
                initialMode={newChatMode}
                setAutoProcessFunctionCalls={shouldAutoProcess => {
                  if (!selectedAiRequest) return;
                  setAutoProcessFunctionCalls(
                    selectedAiRequest.id,
                    shouldAutoProcess
                  );
                }}
                i18n={i18n}
                editorCallbacks={editorCallbacks}
                onStartOrOpenChat={onStartOrOpenChat}
              />
            </div>
          </Paper>
          {renderCreateAiProjectDialog({
            onCreateEmptyProject,
            onCreateProjectFromExample,
          })}
          <AskAiHistory
            open={isHistoryOpen}
            onClose={onCloseHistory}
            onSelectAiRequest={aiRequest => {
              // Immediately switch the UI and refresh in the background.
              updateAiRequest(aiRequest.id, aiRequest);
              setSelectedAiRequestId(aiRequest.id);
              refreshAiRequest(aiRequest.id);
            }}
            selectedAiRequestId={selectedAiRequestId}
          />
        </>
      );
    }
  ),
  // Prevent any update to the editor if the editor is not active,
  // and so not visible to the user.
  (prevProps, nextProps) => prevProps.isActive || nextProps.isActive
);

export const renderAskAiEditorContainer = (
  props: RenderEditorContainerPropsWithRef
) => (
  <I18n>
    {({ i18n }) => (
      <AskAiEditor
        ref={props.ref}
        i18n={i18n}
        project={props.project || null}
        resourceManagementProps={props.resourceManagementProps}
        fileMetadata={props.fileMetadata}
        storageProvider={props.storageProvider}
        setToolbar={props.setToolbar}
        isActive={props.isActive}
        onCreateEmptyProject={props.onCreateEmptyProject}
        onCreateProjectFromExample={props.onCreateProjectFromExample}
        onOpenLayout={props.onOpenLayout}
        onSceneEventsModifiedOutsideEditor={
          props.onSceneEventsModifiedOutsideEditor
        }
        onExtensionInstalled={props.onExtensionInstalled}
        initialMode={
          (props.extraEditorProps && props.extraEditorProps.mode) || null
        }
        initialAiRequestId={
          (props.extraEditorProps && props.extraEditorProps.aiRequestId) || null
        }
        onOpenAskAi={props.onOpenAskAi}
      />
    )}
  </I18n>
);
