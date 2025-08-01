// @flow
import * as React from 'react';
import EventsSheet, { type EventsSheetInterface } from '../../EventsSheet';
import { sendEventsExtractedAsFunction } from '../../Utils/Analytics/EventSender';
import {
  type RenderEditorContainerProps,
  type RenderEditorContainerPropsWithRef,
  type SceneEventsOutsideEditorChanges,
} from './BaseEditor';
import { ProjectScopedContainersAccessor } from '../../InstructionOrExpression/EventsScope';
import { type ObjectWithContext } from '../../ObjectsList/EnumerateObjects';

export class EventsEditorContainer extends React.Component<RenderEditorContainerProps> {
  editor: ?EventsSheetInterface;

  shouldComponentUpdate(nextProps: RenderEditorContainerProps) {
    // We stop updates when the component is inactive.
    // If it's active, was active or becoming active again we let update propagate.
    // Especially important to note that when becoming inactive, a "last" update is allowed.
    return this.props.isActive || nextProps.isActive;
  }

  componentDidMount() {
    if (this.props.isActive) {
      const layout = this.getLayout();
      this.props.setPreviewedLayout(layout ? layout.getName() : null);
    }
  }

  componentDidUpdate(prevProps: RenderEditorContainerProps) {
    if (!prevProps.isActive && this.props.isActive) {
      const layout = this.getLayout();
      this.props.setPreviewedLayout(layout ? layout.getName() : null);
    }
  }

  getProject(): ?gdProject {
    return this.props.project;
  }

  updateToolbar() {
    if (this.editor) this.editor.updateToolbar();
  }

  forceUpdateEditor() {
    // No updates to be done.
  }

  onEventsBasedObjectChildrenEdited() {
    // No thing to be done.
  }

  onSceneObjectEdited(scene: gdLayout, objectWithContext: ObjectWithContext) {
    // No thing to be done.
  }

  onSceneObjectsDeleted(scene: gdLayout) {
    // No thing to be done.
  }

  onSceneEventsModifiedOutsideEditor(changes: SceneEventsOutsideEditorChanges) {
    if (this.getLayout() === changes.scene) {
      if (this.editor)
        this.editor.onEventsModifiedOutsideEditor({
          newOrChangedAiGeneratedEventIds:
            changes.newOrChangedAiGeneratedEventIds,
        });
    }
  }

  getLayout(): ?gdLayout {
    const { project, projectItemName } = this.props;
    if (
      !project ||
      !projectItemName ||
      !project.hasLayoutNamed(projectItemName)
    )
      return null;

    return project.getLayout(projectItemName);
  }

  onBeginCreateEventsFunction = () => {
    sendEventsExtractedAsFunction({
      step: 'begin',
      parentEditor: 'scene-events-editor',
    });
  };

  onCreateEventsFunction = (extensionName, eventsFunction) => {
    this.props.onCreateEventsFunction(
      extensionName,
      eventsFunction,
      'scene-events-editor'
    );
  };

  render() {
    const { project, projectItemName } = this.props;
    const layout = this.getLayout();
    if (!layout || !project) {
      //TODO: Error component
      return <div>No layout called {projectItemName} found!</div>;
    }

    const scope = {
      project,
      layout,
    };
    const projectScopedContainersAccessor = new ProjectScopedContainersAccessor(
      scope
    );

    return (
      <EventsSheet
        ref={editor => (this.editor = editor)}
        setToolbar={this.props.setToolbar}
        onOpenLayout={this.props.onOpenLayout}
        resourceManagementProps={this.props.resourceManagementProps}
        openInstructionOrExpression={this.props.openInstructionOrExpression}
        onCreateEventsFunction={this.onCreateEventsFunction}
        onBeginCreateEventsFunction={this.onBeginCreateEventsFunction}
        unsavedChanges={this.props.unsavedChanges}
        project={project}
        scope={scope}
        globalObjectsContainer={project.getObjects()}
        objectsContainer={layout.getObjects()}
        projectScopedContainersAccessor={projectScopedContainersAccessor}
        events={layout.getEvents()}
        onOpenExternalEvents={this.props.onOpenExternalEvents}
        isActive={this.props.isActive}
        hotReloadPreviewButtonProps={this.props.hotReloadPreviewButtonProps}
        onExtensionInstalled={this.props.onExtensionInstalled}
      />
    );
  }
}

export const renderEventsEditorContainer = (
  props: RenderEditorContainerPropsWithRef
) => <EventsEditorContainer {...props} />;
