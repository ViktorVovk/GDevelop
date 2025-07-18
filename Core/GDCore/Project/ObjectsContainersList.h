#pragma once
#include <vector>

#include "Variable.h"
#include "GDCore/Project/ObjectsContainer.h"

namespace gd {
class String;
class Project;
class Layout;
class VariablesContainer;
class Object;
class ObjectConfiguration;
}  // namespace gd

namespace gd {

/**
 * \brief A list of objects containers, useful for accessing objects in a
 * scoped way, along with methods to access them.
 *
 * \see gd::Object
 * \see gd::ObjectsContainer
 * \see gd::Project
 * \see gd::Layout
 *
 * \ingroup PlatformDefinition
 */
class GD_CORE_API ObjectsContainersList {
 public:
  virtual ~ObjectsContainersList(){};

  static ObjectsContainersList MakeNewEmptyObjectsContainersList();

  static ObjectsContainersList MakeNewObjectsContainersListForProjectAndLayout(
      const gd::Project& project, const gd::Layout& layout);

  static ObjectsContainersList MakeNewObjectsContainersListForProject(
      const gd::Project& project);

  static ObjectsContainersList MakeNewObjectsContainersListForContainers(
      const gd::ObjectsContainer& globalObjectsContainer,
      const gd::ObjectsContainer& objectsContainer);

  static ObjectsContainersList MakeNewObjectsContainersListForContainer(
      const gd::ObjectsContainer& objectsContainer);

  /**
   * \brief Check if the specified object or group exists.
   */
  bool HasObjectOrGroupNamed(const gd::String& name) const;

  /**
   * \brief Check if the specified object exists ignoring groups.
   */
  bool HasObjectNamed(const gd::String& name) const;

  enum VariableExistence {
    DoesNotExist,
    Exists,
    GroupIsEmpty,
    ExistsOnlyOnSomeObjectsOfTheGroup
  };

  /**
   * \brief Check if the specified object or group has the specified variable in
   * its declared variables.
   */
  VariableExistence HasObjectOrGroupWithVariableNamed(
      const gd::String& objectOrGroupName,
      const gd::String& variableName) const;

  /**
   * \brief Check if the specified object or group has the specified variables
   * container.
   */
  bool HasObjectOrGroupVariablesContainer(
      const gd::String& objectOrGroupName,
      const gd::VariablesContainer& variablesContainer) const;

  /**
   * \brief Return the container of the variables for the specified object or
   * group of objects.
   *
   * \warning In most cases, prefer to use other methods to access variables or use
   * ObjectVariableHelper::MergeVariableContainers if you know you're dealing with a group.
   * This is because the variables container of an object group does not exist and the one from
   * first object of the group will be returned.
   */
  const gd::VariablesContainer* GetObjectOrGroupVariablesContainer(
      const gd::String& objectOrGroupName) const;

  /**
   * \brief Get a type from an object/group variable.
   */
  gd::Variable::Type GetTypeOfObjectOrGroupVariable(const gd::String& objectOrGroupName, const gd::String& variableName) const;

  /**
   * \brief Get a type from an object/group name.
   * \note If a group contains only objects of a same type, then the group has
   * this type. Otherwise, it is considered as an object without any specific
   * type.
   *
   * @return Type of the object/group.
   */
  gd::String GetTypeOfObject(const gd::String& objectName) const;

  /**
   * \brief Check if an object or all object of a group has a behavior.
   */
  bool HasBehaviorInObjectOrGroup(const gd::String& objectOrGroupName,
                                  const gd::String& behaviorName) const;

  /**
   * \brief Get the type of a behavior if an object or all objects of a group
   * has it.
   */
  gd::String GetTypeOfBehaviorInObjectOrGroup(
      const gd::String& objectOrGroupName,
      const gd::String& behaviorName,
      bool searchInGroups = true) const;

  /**
   * \brief Get a type from a behavior name
   * @return Type of the behavior.
   * @deprecated - Use GetTypeOfBehaviorInObjectOrGroup instead.
   */
  gd::String GetTypeOfBehavior(const gd::String& behaviorName,
                               bool searchInGroups = true) const;

  /**
   * \brief Get behaviors of an object/group
   * \note The behaviors of a group are the behaviors which are found in common
   * when looking all the objects of the group.
   *
   * @return Vector containing names of behaviors
   */
  std::vector<gd::String> GetBehaviorsOfObject(
      const gd::String& objectName, bool searchInGroups = true) const;

  /**
   * \brief Get behaviors of an object/group of a given behavior type.
   * \note The behaviors of a group are the behaviors which are found in common
   * when looking all the objects of the group.
   *
   * @return Vector containing names of behaviors
   */
  std::vector<gd::String>
  GetBehaviorNamesInObjectOrGroup(const gd::String &objectOrGroupName,
                       const gd::String &behaviorType,
                       bool searchInGroups = true) const;

  /**
   * \brief Get the animation names of an object/group.
   * \note The animation names of a group are the animation names common to
   * every object of the group.
   *
   * @return The names of animations
   */
  std::vector<gd::String>
  GetAnimationNamesOfObject(const gd::String &objectOrGroupName) const;

  /**
   * \brief Return a list containing all objects referred to by the group.
   * If an object name is passed, then only this object name is returned.
   *
   * If \a onlyObjectToSelectIfPresent is set and present in the group(s),
   * only this object will be returned. This is useful for considering this
   * object as the "currently selected" object, when generating a condition or
   * an action.
   */
  std::vector<gd::String> ExpandObjectName(
      const gd::String& objectOrGroupName,
      const gd::String& onlyObjectToSelectIfPresent = "") const;

  void ForEachObject(std::function<void(const gd::Object& object)> fn) const;

  /**
   * \brief Call the callback for each object or group name matching the
   * search passed in parameter.
   */
  void ForEachNameMatchingSearch(
      const gd::String& search,
      std::function<void(const gd::String& name,
                         const gd::ObjectConfiguration* objectConfiguration)>
          fn) const;

  /**
   * \brief Call the callback for each variable of the object (or group)
   * matching the search passed in parameter.
   */
  void ForEachObjectOrGroupVariableMatchingSearch(
      const gd::String& objectOrGroupName,
      const gd::String& search,
      std::function<void(const gd::String& variableName,
                         const gd::Variable& variable)> fn) const;

  /**
   * \brief Return the source type of the container for the specified object or
   * group of objects.
   */
  const gd::ObjectsContainer::SourceType GetObjectsContainerSourceType(
      const gd::String& objectOrGroupName) const;

  /**
   * Get the objects container for for the specified object or group of objects.
   */
  const ObjectsContainer *
  GetObjectsContainerFromObjectName(const gd::String &objectOrGroupName) const;

  /**
   * \brief Return a the objects container at position \a index.
   *
   * \warning The returned `ObjectsContainer` may contain cloned objects (in the case of
   * `ProjectScopedContainers::MakeNewProjectScopedContainersForEventsBasedObject`)
   * or "fake" objects used by events like parameters. They must not be used to
   * edit the objects.
   * Search for "ProjectScopedContainers wrongly containing temporary objects containers or objects"
   * in the codebase.
   */
  const gd::ObjectsContainer &GetObjectsContainer(std::size_t index) const;

  /**
   * \brief Return the number of objects containers.
   */
  std::size_t GetObjectsContainersCount() const;

  /** Do not use - should be private but accessible to let Emscripten create a
   * temporary. */
  ObjectsContainersList(){};

 private:
  const gd::Object* GetObject(const gd::String& name) const;

  bool HasObjectWithVariableNamed(const gd::String& objectName,
                                  const gd::String& variableName) const;

  bool HasObjectVariablesContainer(
      const gd::String& objectName,
      const gd::VariablesContainer& variablesContainer) const;

  const gd::VariablesContainer* GetObjectVariablesContainer(
      const gd::String& objectName) const;

  gd::Variable::Type GetTypeOfObjectVariable(const gd::String& objectName, const gd::String& variableName) const;

  void ForEachObjectVariableMatchingSearch(
      const gd::String& objectOrGroupName,
      const gd::String& search,
      std::function<void(const gd::String& variableName,
                         const gd::Variable& variable)> fn) const;

  void Add(const gd::ObjectsContainer& objectsContainer) {
    objectsContainers.push_back(&objectsContainer);
  };

  std::vector<const gd::ObjectsContainer*> objectsContainers;
};

}  // namespace gd